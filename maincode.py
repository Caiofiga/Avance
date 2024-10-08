import cv2
import mediapipe as mp
import numpy as np
import websockets
import websocket
import asyncio
import json
import threading
from queue import Queue, Empty
from bokeh.plotting import figure, curdoc
from bokeh.models import ColumnDataSource
from bokeh.embed import server_session, server_document
from bokeh.client import pull_session
from bokeh.server.server import Server
from bokeh.application import Application
from bokeh.application.handlers.function import FunctionHandler
from bokeh.io.export import export_svg, export_svgs
from tornado.ioloop import IOLoop
import json
import websocket
import threading
from flask import Flask, render_template, redirect, request, session
import secrets
import tempfile

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

        # Optional: Draw the center point on the image for reference
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

# region graph creation

# region main graph creation
data = ColumnDataSource(data=dict(time=[], x=[], y=[], z=[]))
starttime = 0

x_data_color = "#d32f2f"  # red
y_data_color = "#7cb342"  # green
z_data_color = "#0288d1"  # blue
background_color = "#fafafa"  # light grey

lock = threading.Lock()

p = figure(title="Dados de sensores", x_axis_label="Tempo(segundos)",
           y_axis_label="Sla mano(Newtons eu acho)", background_fill_color=background_color)
p.line(x='time', y='x', source=data,
       line_color=x_data_color, legend_label='Eixo X')
p.line(x='time', y='y', source=data,
       line_color=y_data_color, legend_label=' Eixo Y')
p.line(x='time', y='z', source=data,
       line_color=z_data_color, legend_label=' Eixo Z')
p.x_range.follow = "end"
p.y_range.follow = "end"
doc = curdoc()
# endregion

# region bokeh server stuff
# tornado requires my to provide an Application to its server
# shitty workaround incoming


def modify_doc(document):
    global doc
    document.add_root(p)
    doc = document


def on_accel_ws_message(ws, message):
    global starttime

    # Parse the message from the websocket
    values = json.loads(message)['values']
    timestamp = json.loads(message)['timestamp']

    with lock:
        if not starttime:
            starttime = timestamp
        newdata = dict(
            time=[(timestamp-starttime)/1000000000],
            x=[values[0]],
            y=[values[1]],
            z=[values[2]])

        # Stream the new data to the plot
        doc.add_next_tick_callback(lambda: data.stream(newdata))


def start_bokeh_server():
    # bokeh has integration with tornado, helping to create multhreading
    io_loop = IOLoop.current()
    # PPS : FUCK Multithreading
    bokeh_app = Application(FunctionHandler(modify_doc))
    server = Server({'/': bokeh_app}, io_loop=io_loop, port=5006,
                    # apparently, localhost is not the same as 127.0.0.1
                    allow_websocket_origin=["localhost:5000", 'localhost:5006', "127.0.0.1:5000"])
    # 1 fucking hour, goddamn
    server.start()

    io_loop.start()


def on_accel_ws_open(ws):
    print(f"Accelerometer: Connection opened with {ws.url}")


def on_accel_ws_close(ws):
    print(f"Accelerometer: Connection closed with {ws.url}")


def run_sensor_websocket():
    uri = "ws://192.168.50.50:8080/sensor/connect?type=android.sensor.accelerometer"
    ws_app = websocket.WebSocketApp(
        uri, on_message=on_accel_ws_message, on_open=on_accel_ws_open, on_close=on_accel_ws_close)
    ws_app.run_forever()

# endregion

# endregion

# region flask app stuff


flaskapp = Flask(__name__)
flaskapp.secret_key = secrets.token_urlsafe(16)


def startflaskserver():
    flaskapp.run(host='0.0.0.0', port=5000)


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
            # need to get a snapshot of the graph and restart it
            with tempfile.NamedTemporaryFile(suffix='.svg', dir='temp') as f:
                filename = f.name
                f.write(export_svg(p))

        session[request.form["game"]] = [request.form['score'], filename]

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
# endregion


async def main():
    # Start the camera WebSocket server
    camera_ws_server = await websockets.serve(handler, "localhost", 6789)
    broadcaster_task = asyncio.create_task(broadcaster())
    # Keep the event loop running indefinitely
    await asyncio.Future()  # Run forever

if __name__ == "__main__":
    try:
        # this is the sensor gathering thread
        sensor_thread = threading.Thread(
            target=run_sensor_websocket, daemon=True)
        sensor_thread.start()

        # this is the camera catching and processing thread
        video_thread = threading.Thread(target=process_video, daemon=True)
        video_thread.start()

        # this is finally the graph creating thread
        bokeh_thread = threading.Thread(target=start_bokeh_server, daemon=True)
        bokeh_thread.start()

        flask_thread = threading.Thread(target=startflaskserver, daemon=True)
        flask_thread.start()

        asyncio.run(main())

    finally:
        cap.release()
        cv2.destroyAllWindows()



