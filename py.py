import cv2
import mediapipe as mp
import numpy as np
import websockets
import asyncio
import json
import threading
from queue import Queue, Empty

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

# Global set of connected clients
connected_clients = set()

# Thread-safe Queue for displacement data
displacement_queue = Queue()

# WebSocket handler function


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


async def main():
    # Start WebSocket server
    websocket_server = await websockets.serve(handler, "localhost", 6789)

    # Start broadcaster task
    broadcaster_task = asyncio.create_task(broadcaster())

    # Keep the event loop running indefinitely
    await asyncio.Future()  # Run forever

if __name__ == "__main__":
    try:
        # Start the video processing in a separate thread
        video_thread = threading.Thread(target=process_video)
        video_thread.start()

        # Run the asyncio event loop
        asyncio.run(main())
    finally:
        cap.release()
        cv2.destroyAllWindows()
