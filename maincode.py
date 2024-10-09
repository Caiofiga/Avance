import cv2
import mediapipe as mp
import numpy as np
import websockets
import asyncio
import json
import threading
from queue import Queue, Empty
import json
import threading
import uuid
from flask import Flask, request, render_template, session, redirect
from flask_cors import CORS
from scipy.signal import butter, filtfilt
import matplotlib.pyplot as plt

# Preface: This is a fucking mess


# region Hand Tracking

# Initialize MediaPipe Hands.
mp_hands = mp.solutions.hands
hands = mp_hands.Hands(
    static_image_mode=False,
    max_num_hands=1,
    min_detection_confidence=0.5,
    min_tracking_confidence=0.5)
mp_drawing = mp.solutions.drawing_utils

# Initialize video capture.
cap = cv2.VideoCapture(0)


def process_video():
    alpha = 0.2  # Smoothing factor for EMA (between 0 and 1)
    smoothed_x, smoothed_y = None, None
    movement_threshold = 2.0  # Pixels; adjust based on your use case
    missing_hand_frames = 0  # Counter for frames without detected hand

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        # Flip the frame horizontally for a selfie-view display.
        frame = cv2.flip(frame, 1)

        # Get frame dimensions and compute center coordinates
        frame_height, frame_width = frame.shape[:2]
        center_x, center_y = frame_width / 2, frame_height / 2

        # Convert the BGR image to RGB.
        image = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)

        # Process the image and detect hands.
        results = hands.process(image)

        # Convert back to BGR for OpenCV.
        image = cv2.cvtColor(image, cv2.COLOR_RGB2BGR)

        if results.multi_hand_landmarks:
            missing_hand_frames = 0  # Reset counter
            for hand_landmarks in results.multi_hand_landmarks:
                # Get coordinates of the wrist landmark (landmark 0).
                x = hand_landmarks.landmark[0].x * frame_width
                y = hand_landmarks.landmark[0].y * frame_height

                # Initialize smoothed positions
                if smoothed_x is None or smoothed_y is None:
                    smoothed_x, smoothed_y = x, y
                else:
                    # Apply Exponential Moving Average
                    smoothed_x = alpha * x + (1 - alpha) * smoothed_x
                    smoothed_y = alpha * y + (1 - alpha) * smoothed_y

                # Calculate displacement relative to the center of the frame
                delta_x = smoothed_x - center_x
                delta_y = smoothed_y - center_y

                # Apply movement threshold
                if abs(delta_x) < movement_threshold:
                    delta_x = 0
                if abs(delta_y) < movement_threshold:
                    delta_y = 0

                displacement = {'dx': delta_x, 'dy': delta_y}
                # Put displacement data into the queue
                displacement_queue.put(displacement)
                # For visualization purposes.
                cv2.putText(image, f"dx: {delta_x:.2f}, dy: {delta_y:.2f}", (10, 30),
                            cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 0, 0), 2)
                # Draw the hand landmarks on the image.
                mp_drawing.draw_landmarks(
                    image, hand_landmarks, mp_hands.HAND_CONNECTIONS)
        else:
            missing_hand_frames += 1
            # Reset smoothed positions after a certain number of frames without detection
            if missing_hand_frames > 10:
                smoothed_x, smoothed_y = None, None

        # Optional: Draw the cente he image for reference
        cv2.circle(image, (int(center_x), int(center_y)), 5, (0, 255, 0), -1)

        # Display the resulting image.
        cv2.imshow('Hand Tracking', image)

        # Exit if 'q' is pressed
        if cv2.waitKey(1) & 0xFF == ord('q'):
            break

        # No need to sleep; this function runs in a separate thread

# endregion


# region WebSocket Server


# Global set of connected clients
connected_clients = set()

# Thread-safe Queue for displacement data
displacement_queue = Queue()


async def handler(websocket, path):
    # Register client
    connected_clients.add(websocket)
    print(f"Client connected: {websocket.remote_address}")
    try:
        await websocket.wait_closed()
    except Exception as e:
        print(f"Exception in handler: {e}")
    finally:
        connected_clients.remove(websocket)
        print(f"Client disconnected: {websocket.remote_address}")

# Function to broadcast data to all connected clients


async def broadcaster():
    while True:
        try:
            # Try to get data from the queue without blocking
            displacement = displacement_queue.get_nowait()
        except Empty:
            # If queue is empty, yield control and continue
            await asyncio.sleep(0.001)
            continue
        else:
            if connected_clients:
                message = json.dumps(displacement)
                await asyncio.gather(*(client.send(message) for client in connected_clients))
            displacement_queue.task_done()


# endregion


#region graph creation 
#applying filters and plotting the data
def butter_lowpass_filter(data, cutoff, fs, order=5):
    nyq = 0.5 * fs
    normal_cutoff = cutoff / nyq
    b, a = butter(order, normal_cutoff, btype='low', analog=False)
    y = filtfilt(b, a, data)
    return y


def plot_with_breaks(times, data, label, color, ax, time_limit=200):
    """Helper function to plot data with line breaks after a time limit."""
    start_idx = 0
    for i, time in enumerate(times):
        if time > time_limit:
            # Plot the segment from start_idx to i
            ax.plot(times[start_idx:i], data[start_idx:i],
                    label=label, color=color)
            start_idx = i  # Move the start index to the next segment
            time_limit += 200  # Increase the time limit for the next row
    # Plot the final segment
    ax.plot(times[start_idx:], data[start_idx:], label=label, color=color)

#this segments the data and splits it into separate graphs
def get_segmented_data(times, data, start_time, end_time):
    """Returns a segment of the times and data arrays between start_time and end_time."""
    segment_times = [t for t in times if start_time <= t < end_time]
    segment_data = [data[i]
                    for i, t in enumerate(times) if start_time <= t < end_time]
    return segment_times, segment_data

def creategraph(graphdata):

    data = graphdata.get_json()['data']

    try:
        points = [{'time': point['time'], 'x': point['x'],
                   'y': point['y'], 'z': point['z']} for point in data]
    except KeyError:
        return '400 Bad Request: Invalid data format', 400

    times = [point['time'] for point in points]
    x_vals = [point['x'] for point in points]
    y_vals = [point['y'] for point in points]
    z_vals = [point['z'] for point in points]

    # Ensure that data lists are non-empty and of equal length
    if len(times) == 0 or len(times) != len(x_vals) or len(x_vals) != len(y_vals) or len(y_vals) != len(z_vals):
        return '400 Bad Request: Data arrays are empty or mismatched in length', 400

    # Filter parameters
    #shittyly calculated averages: 
    #{ time: 1.261, x: 0.0375, y: 0.0177, z: 9.864 }
    cutoff_freq_x = 0.0375;
    cutoff_freq_y = 0.0177;
    cutoff_freq_z = 9.864;
    sampling_rate = 50.0  # Sampling rate, adjust as needed

    # Apply noise filter (low-pass filter) to the x, y, z data
    filtered_x = butter_lowpass_filter(x_vals, cutoff_freq_x, sampling_rate)
    filtered_y = butter_lowpass_filter(y_vals, cutoff_freq_y, sampling_rate)
    filtered_z = butter_lowpass_filter(z_vals, cutoff_freq_z, sampling_rate)
    # Calculate how many rows we need based on the time
    max_time = max(times)
    num_time_segments = int(np.ceil(max_time / 200.0))

    # Create a figure with 3 * num_time_segments rows and 1 column for subplots
    plt.figure(figsize=(10, 8 * num_time_segments))

    for i in range(num_time_segments):
        # Define the time limits for each segment
        start_time = i * 200
        end_time = (i + 1) * 200

        # Get the data segment for the current time range
        seg_times_x, seg_x_vals = get_segmented_data(
            times, filtered_x, start_time, end_time)
        seg_times_y, seg_y_vals = get_segmented_data(
            times, filtered_y, start_time, end_time)
        seg_times_z, seg_z_vals = get_segmented_data(
            times, filtered_z, start_time, end_time)

        # Plot X-axis data
        ax1 = plt.subplot(3 * num_time_segments, 1, i * 3 + 1)
        ax1.plot(seg_times_x, seg_x_vals, label='Filtered X', color='r')
        ax1.set_title(f'X Axis - Segment {i+1} ({start_time} to {end_time}s)')
        ax1.set_xlabel('Time (s)')
        ax1.set_ylabel('Acceleration')
        ax1.grid(True)

        # Plot Y-axis data
        ax2 = plt.subplot(3 * num_time_segments, 1, i * 3 + 2)
        ax2.plot(seg_times_y, seg_y_vals, label='Filtered Y', color='g')
        ax2.set_title(f'Y Axis - Segment {i+1} ({start_time} to {end_time}s)')
        ax2.set_xlabel('Time (s)')
        ax2.set_ylabel('Acceleration')
        ax2.grid(True)

        # Plot Z-axis data
        ax3 = plt.subplot(3 * num_time_segments, 1, i * 3 + 3)
        ax3.plot(seg_times_z, seg_z_vals, label='Filtered Z', color='b')
        ax3.set_title(f'Z Axis - Segment {i+1} ({start_time} to {end_time}s)')
        ax3.set_xlabel('Time (s)')
        ax3.set_ylabel('Acceleration')
        ax3.grid(True)

    # Adjust layout to prevent overlap
    plt.tight_layout()

    # Save the plot to a unique file
    filename = f"plot_{uuid.uuid4()}.png"
    plt.savefig(filename)

    return filename
#endregion


# region flask app stuff


flaskapp = Flask(__name__)
cors = CORS(flaskapp)


#region website serving
@flaskapp.route('/')
def index():

    # this gets a reference to the running bokeh session
    # session = pull_session(url='http://localhost:5006/')
    # this generates the script to use in my flask page
    # script = server_session(session_id=session.id,
    #                        url='http://localhost:5006/')
    return render_template('testgame.html', bokeh_script=0)


@flaskapp.route('/save_score', methods=['POST'])
def save_score():
    if request.method == 'POST':
        if not 'name' in session:
            session['name'] = request.form['name']
            #create the graph instead
            data = request.form['data']
            graphdata = json.loads(data)["graph"] #{ time x y z };
            graphname = creategraph(graphdata)
        session[request.form["game"]] = [request.form['score'], graphname]

    match request.form['game']:
        case 'game1':
            return redirect('/game2')
        # and so on for the others

        case _:  # Python and its idiocies annoy me sometimes
            return redirect('/endgame')

@flaskapp.route('/endgame')
def endgame():
    playerdata = session.copy()
    return render_template('endgame.html', playerdata=playerdata)
#endregion

def startflaskserver():
    flaskapp.run(host='0.0.0.0', port=5000)


# endregion


async def main():
    # Start the camera WebSocket server
    camera_ws_server = await websockets.serve(handler, "localhost", 6789)
    broadcaster_task = asyncio.create_task(broadcaster())
    # Keep the event loop running indefinitely
    await asyncio.Future()  # Run forever

if __name__ == "__main__":
    try:
        # this is the camera catching and processing thread
        video_thread = threading.Thread(target=process_video, daemon=True)
        video_thread.start()

        flask_thread = threading.Thread(target=startflaskserver, daemon=True)
        flask_thread.start()

        asyncio.run(main())

    finally:
        cap.release()
        cv2.destroyAllWindows()



