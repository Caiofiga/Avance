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
from flask import Flask, request, render_template, session, redirect, url_for, jsonify
from flask_cors import CORS
from flask_socketio import SocketIO, emit
from scipy.signal import butter, filtfilt
import matplotlib.pyplot as plt
from functools import wraps
import secrets
import base64
import platform
import subprocess
import os

# Preface: This is a fucking mess


# region Hand Tracking

# Initialize MediaPipe Hands.
mp_hands = mp.solutions.hands
hands = mp_hands.Hands(
    static_image_mode=False,
    max_num_hands=1,
    min_detection_confidence=0.5,
    min_tracking_confidence=0.5)
mp_pose = mp.solutions.pose
pose = mp_pose.Pose()
mp_drawing = mp.solutions.drawing_utils

# Initialize video capture.
cap = cv2.VideoCapture(0)


def calculate_arm_flexion_angle(landmarks, frame_width, frame_height):
    # Get shoulder, elbow, and wrist landmarks for angle calculation
    shoulder = np.array([
        landmarks[mp_pose.PoseLandmark.LEFT_SHOULDER].x * frame_width,
        landmarks[mp_pose.PoseLandmark.LEFT_SHOULDER].y * frame_height
    ])
    elbow = np.array([
        landmarks[mp_pose.PoseLandmark.LEFT_ELBOW].x * frame_width,
        landmarks[mp_pose.PoseLandmark.LEFT_ELBOW].y * frame_height
    ])
    wrist = np.array([
        landmarks[mp_pose.PoseLandmark.LEFT_WRIST].x * frame_width,
        landmarks[mp_pose.PoseLandmark.LEFT_WRIST].y * frame_height
    ])

    # Calculate vectors
    vector1 = shoulder - elbow
    vector2 = wrist - elbow

    # Calculate angle using the dot product
    angle = np.arccos(np.dot(vector1, vector2) /
                      (np.linalg.norm(vector1) * np.linalg.norm(vector2)))
    angle_degrees = np.degrees(angle)

    return angle_degrees, shoulder, elbow, wrist


def process_video():
    alpha = 0.2  # Smoothing factor for EMA
    smoothed_x, smoothed_y = None, None
    movement_threshold = 2.0
    missing_hand_frames = 0
    while True:
        ret, frame = cap.read()
        if not ret:
            break

        # Flip the frame horizontally for a selfie-view display.
        frame = cv2.flip(frame, 1)
        frame_height, frame_width = frame.shape[:2]
        center_x, center_y = frame_width / 2, frame_height / 2

        # Convert the BGR image to RGB.
        image = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)

        # Process the image for hand tracking
        hand_results = hands.process(image)

        # Process the image for pose tracking
        pose_results = pose.process(image)

        # Convert back to BGR for OpenCV.
        image = cv2.cvtColor(image, cv2.COLOR_RGB2BGR)

        if hand_results.multi_hand_landmarks and pose_results.pose_landmarks:

            missing_hand_frames = 0
            for hand_landmarks in hand_results.multi_hand_landmarks:
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

                angle, shoulder, elbow, wrist = calculate_arm_flexion_angle(
                    pose_results.pose_landmarks.landmark, frame_width, frame_height)

                displacement = {'dx': delta_x, 'dy': delta_y, 'angle': angle}
                displacement_queue.put(displacement)

                # Apply movement threshold
                if abs(delta_x) < movement_threshold:
                    delta_x = 0
                if abs(delta_y) < movement_threshold:
                    delta_y = 0

                # Draw lines connecting shoulder to elbow and elbow to wrist
                cv2.line(image, tuple(shoulder.astype(int)),
                         tuple(elbow.astype(int)), (0, 255, 0), 3)
                cv2.line(image, tuple(elbow.astype(int)),
                         tuple(wrist.astype(int)), (0, 255, 0), 3)

                # Display the calculated angle at the elbow position
                cv2.putText(image, f"{angle:.2f} degrees", (10, 70),
                            cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 255), 2)

                cv2.putText(image, f"dx: {delta_x:.2f}, dy: {delta_y:.2f}", (10, 30),
                            cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 0, 0), 2)
                mp_drawing.draw_landmarks(
                    image, hand_landmarks, mp_hands.HAND_CONNECTIONS)
        else:
            missing_hand_frames += 1
            if missing_hand_frames > 10:
                smoothed_x, smoothed_y = None, None

        # Draw center point on the image
        cv2.circle(image, (int(center_x), int(center_y)), 5, (0, 255, 0), -1)

        # Encode the frame as JPEG
        _, buffer = cv2.imencode('.jpg', image)
        frame_data = base64.b64encode(buffer).decode('utf-8')

        # Send frame to the client via WebSocket
        socketio.emit('video_feed', {'frame': frame_data}, namespace='/camera')

        # Exit if 'q' is pressed
        if cv2.waitKey(1) & 0xFF == ord('q'):
            break

# endregion


# region Hand WebSocket Server


# Global set of connected clients
connected_clients = set()

# Thread-safe Queue for displacement data
displacement_queue = Queue()


async def handler(websocket):
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


# region graph creation
# applying filters and plotting the data
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

# this segments the data and splits it into separate graphs


def get_segmented_data(times, data, start_time, end_time):
    """Returns a segment of the times and data arrays between start_time and end_time."""
    segment_times = [t for t in times if start_time <= t < end_time]
    segment_data = [data[i]
                    for i, t in enumerate(times) if start_time <= t < end_time]
    return segment_times, segment_data


def creategraphgame1(graphdata, overlaps):

    data = graphdata

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
    # shittyly calculated averages:
    # { time: 1.261, x: 0.0375, y: 0.0177, z: 9.864 }
    cutoff_freq_x = 0.0375
    cutoff_freq_y = 0.0177
    cutoff_freq_z = 9.864
    sampling_rate = 50.0  # Sampling rate, adjust as needed

    filtered_x = x_vals
    filtered_y = y_vals
    filtered_z = z_vals

    # Calculate how many rows we need based on the time
    max_time = max(times)
    num_time_segments = int(np.ceil(max_time / 200.0))

    # Create a figure with 3 * num_time_segments rows and 1 column for subplots
    plt.figure(figsize=(10, 8 * num_time_segments))

    for i in range(num_time_segments):  # this is when we loop-de-loop
        # somehow, I need to plot the overlap times here
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

        ax2 = plt.subplot(3 * num_time_segments, 1, i * 3 + 2)
        ax2.plot(seg_times_y, seg_y_vals, label='Filtered Y', color='g')
        ax2.set_title(f'Y Axis - Segment {i+1} ({start_time} to {end_time}s)')
        ax2.set_xlabel('Time (s)')
        ax2.set_ylabel('Acceleration')
        ax2.grid(True)

        ax3 = plt.subplot(3 * num_time_segments, 1, i * 3 + 3)
        ax3.plot(seg_times_z, seg_z_vals, label='Filtered Z', color='b')
        ax3.set_title(f'Z Axis - Segment {i+1} ({start_time} to {end_time}s)')
        ax3.set_xlabel('Time (s)')
        ax3.set_ylabel('Acceleration')
        ax3.grid(True)

    for plantid, times in overlaps.items():
        # Sort the times to ensure proper ordering of events
        times = sorted(times, key=lambda x: float(
            x.rstrip('end')) if isinstance(x, str) else x)

        # Color assignment based on plantid
        match plantid:
            case 'plant1':
                color = 'red'
            case 'plant2':
                color = 'green'
            case 'plant3':
                color = 'blue'
            case 'plant4':
                color = 'yellow'
            case 'plant5':
                color = 'black'
            case _:
                color = 'orange'

        dashed_line = False  # Track if a dashed line has been plotted for the plant

        # Plot vertical lines on all three axes (ax1, ax2, ax3)
        for i, time_value in enumerate(times):
            # Determine if time_value has 'end'
            if isinstance(time_value, str):
                time_value_float = float(time_value.rstrip('end'))

                # Check if the next value is a float with the same time
                if i + 1 < len(times) and isinstance(times[i + 1], float) and times[i + 1] == time_value_float:
                    # Skip the solid line at this time since the dashed line takes priority
                    continue

                if dashed_line:
                    # If a dashed line has already been plotted, skip plotting further lines for this plant
                    continue

                # Plot red dashed line on all axes
                ax1.axvline(x=time_value_float, color=color, linestyle='--',
                            label=f'Plant {plantid} with end at {time_value}')
                ax2.axvline(x=time_value_float, color=color, linestyle='--',
                            label=f'Plant {plantid} with end at {time_value}')
                ax3.axvline(x=time_value_float, color=color, linestyle='--',
                            label=f'Plant {plantid} with end at {time_value}')

                # Mark that a dashed line has been plotted
                dashed_line = True

            else:
                # Check if the next value is a string with the same time
                if i + 1 < len(times) and isinstance(times[i + 1], str) and float(times[i + 1].rstrip('end')) == time_value:
                    # Skip the solid line since the next dashed line takes priority
                    continue

                # Only plot solid lines if no dashed line has been plotted yet
                if not dashed_line:
                    ax1.axvline(x=time_value, color=color, linestyle='-',
                                label=f'Plant {plantid} without end at {time_value}')
                    ax2.axvline(x=time_value, color=color, linestyle='-',
                                label=f'Plant {plantid} without end at {time_value}')
                    ax3.axvline(x=time_value, color=color, linestyle='-',
                                label=f'Plant {plantid} without end at {time_value}')

    # Adjust layout to prevent overlap
    plt.tight_layout()

    # Save the plot to a unique file
    filename = f"Graphs/Game1/plot_{uuid.uuid4()}.png"
    plt.savefig(filename)

    return filename


def creategraphgame2(graphdata):

    data = graphdata

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
    # shittyly calculated averages:
    # { time: 1.261, x: 0.0375, y: 0.0177, z: 9.864 }
    cutoff_freq_x = 0.0375
    cutoff_freq_y = 0.0177
    cutoff_freq_z = 9.864
    sampling_rate = 50.0  # Sampling rate, adjust as needed

    filtered_x = x_vals
    filtered_y = y_vals
    filtered_z = z_vals

    # Calculate how many rows we need based on the time
    max_time = max(times)
    num_time_segments = int(np.ceil(max_time / 200.0))

    # Create a figure with 3 * num_time_segments rows and 1 column for subplots
    plt.figure(figsize=(10, 8 * num_time_segments))

    for i in range(num_time_segments):  # this is when we loop-de-loop
        # somehow, I need to plot the overlap times here
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

        ax2 = plt.subplot(3 * num_time_segments, 1, i * 3 + 2)
        ax2.plot(seg_times_y, seg_y_vals, label='Filtered Y', color='g')
        ax2.set_title(f'Y Axis - Segment {i+1} ({start_time} to {end_time}s)')
        ax2.set_xlabel('Time (s)')
        ax2.set_ylabel('Acceleration')
        ax2.grid(True)

        ax3 = plt.subplot(3 * num_time_segments, 1, i * 3 + 3)
        ax3.plot(seg_times_z, seg_z_vals, label='Filtered Z', color='b')
        ax3.set_title(f'Z Axis - Segment {i+1} ({start_time} to {end_time}s)')
        ax3.set_xlabel('Time (s)')
        ax3.set_ylabel('Acceleration')
        ax3.grid(True)

    # Adjust layout to prevent overlap
    plt.tight_layout()

    # Save the plot to a unique file
    filename = f"Graphs/Game2/plot_{uuid.uuid4()}.png"
    plt.savefig(filename)

    return filename


# endregion


# region flask app stuff


flaskapp = Flask(__name__)
cors = CORS(flaskapp)
socketio = SocketIO(flaskapp, cors_allowed_origins="*")
flaskapp.secret_key = secrets.token_urlsafe(16)


def need_calibration(func):
    @wraps(func)  # This preserves the original function's name and metadata
    def wrapper(*args, **kwargs):
        if session.get('calibration_data') is not None:  # Safely access session data
            return func(*args, **kwargs)  # Call the original function
        else:
            # Redirect if calibration data is missing
            return redirect('/calibration')
    return wrapper


def get_latest_file(directory):
    files = [os.path.join(directory, f) for f in os.listdir(
        directory) if os.path.isfile(os.path.join(directory, f))]
    files.sort(key=lambda x: os.path.getmtime(x), reverse=True)
    return files[0] if files else None


@socketio.on('connect', namespace='/camera')
def connect_camera():
    print("Camera client connected")


@socketio.on('disconnect', namespace='/camera')
def disconnect_camera():
    print("Camera client disconnected")


@flaskapp.route('/admin')
def admin():
    return render_template('admin.html')


@flaskapp.route('/calibration', methods=['GET', 'POST'])
def calibrate():
    if request.method == 'GET':
        return render_template('calibration.html')
    elif request.method == "POST":
       # save the calibration_data to session
        raw_data = request.get_data()
        print(f"Raw calibration data: {raw_data}")

        try:
            calibration_data = raw_data.decode('utf-8')
            print(f"Decoded calibration data: {calibration_data}")
            session['calibration_data'] = json.loads(calibration_data)
            print(f"Session calibration data: {session['calibration_data']}")
        except json.JSONDecodeError as e:
            print(f"Error parsing JSON data: {e}")
            # Handle the error appropriately, e.g., return an error response
            return jsonify({"error": "Invalid JSON data"}), 400

        return jsonify({"message": "Data received correctly!"}), 200


@flaskapp.route('/')
def home():
    return render_template('home.html')


@flaskapp.route('/testgame')
@need_calibration
def testgame():
    return render_template('testgame.html')


@flaskapp.route('/estilingue')
@need_calibration
def estilingue():
    return render_template('estilingue.html')


@flaskapp.route('/save_graph1', methods=['POST'])
def save_graph1():
    if request.method == 'POST':
        if 'name' not in session:
            session['name'] = request.json['name']
        # create the graph instead
        data = request.json
        graphdata = data["graph"]  # { time x y z };
        overlaps = data["overlaps"]  # {plantid: time end?}
        graphname = creategraphgame1(graphdata, overlaps)

        return jsonify({'message': 'Score saved for game 1'})


@flaskapp.route('/save_graph2', methods=['POST'])
def save_graph2():
    if request.method == 'POST':
        if 'name' not in session:
            session['name'] = request.json['name']
        # create the graph instead
        data = request.json
        graphdata = data["graph"]  # { time x y z };
        graphname = creategraphgame2(graphdata)

        return jsonify({'message': 'Score saved for game 2'})


@flaskapp.route('/latest_graphs')
def getLatestGraphs():
    def encode_file_to_base64(file_path):
        with open(file_path, "rb") as file:
            return base64.b64encode(file.read()).decode('utf-8')

    game1_graphs = get_latest_file("Graphs/Game1")
    game2_graphs = get_latest_file("Graphs/Game2")

    game1_graphs_encoded = encode_file_to_base64(
        game1_graphs) if game1_graphs else None
    game2_graphs_encoded = encode_file_to_base64(
        game2_graphs) if game2_graphs else None

    return jsonify({
        'game1_graphs': game1_graphs_encoded,
        'game2_graphs': game2_graphs_encoded
    })


@flaskapp.route('/endgame')
def endgame():
    playerdata = session.copy()
    return render_template('endgame.html', playerdata=playerdata)
# endregion

# region admin websocket stuff


@socketio.on('message_from_main')
def handle_message_from_main(data):
    # print('Received message from main:', data)
    # Forward the message to the admin page
    socketio.emit(json.loads(data)['data']['type'], data)


# endregion


def startflaskserver():
    socketio.run(app=flaskapp, host='0.0.0.0', port=5000)


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
