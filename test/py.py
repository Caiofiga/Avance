from flask import Flask, render_template, Response
from flask_socketio import SocketIO, emit
import cv2
import mediapipe as mp
import numpy as np
import threading
import base64

# Initialize Flask app and SocketIO
app = Flask(__name__)
socketio = SocketIO(app, cors_allowed_origins="*")

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
                cv2.putText(image, f"{angle:.2f} degrees", (10, 50),
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

        # Display the resulting image.
        cv2.imshow('Hand and Pose Tracking', image)

        # Exit if 'q' is pressed
        if cv2.waitKey(1) & 0xFF == ord('q'):
            break

# endregion


@app.route('/')
def index():
    return render_template('html.html')


if __name__ == "__main__":
    # Start the video processing thread
    video_thread = threading.Thread(target=process_video, daemon=True)
    video_thread.start()

    # Start the Flask server
    socketio.run(app, host='0.0.0.0', port=5000)

    # Cleanup
    cap.release()
    cv2.destroyAllWindows()
