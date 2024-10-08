from flask import Flask, request
from flask_cors import CORS
import matplotlib.pyplot as plt
import io
import numpy as np
from scipy.signal import butter, filtfilt  # For filtering
import uuid

app = Flask(__name__)
CORS(app)

# Define a simple low-pass Butterworth filter


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


def get_segmented_data(times, data, start_time, end_time):
    """Returns a segment of the times and data arrays between start_time and end_time."""
    segment_times = [t for t in times if start_time <= t < end_time]
    segment_data = [data[i]
                    for i, t in enumerate(times) if start_time <= t < end_time]
    return segment_times, segment_data


@app.route('/savegraph', methods=['POST'])
def save():
    if not request.is_json or 'data' not in request.json:
        return '400 Bad Request: Invalid or missing JSON', 400

    data = request.get_json()['data']

    if not data:
        return '400 Bad Request: Empty data', 400

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
    cutoff_frequency = 2.0  # Set your cutoff frequency
    sampling_rate = 50.0  # Sampling rate, adjust as needed

    # Apply noise filter (low-pass filter) to the x, y, z data
    filtered_x = butter_lowpass_filter(x_vals, cutoff_frequency, sampling_rate)
    filtered_y = butter_lowpass_filter(y_vals, cutoff_frequency, sampling_rate)
    filtered_z = butter_lowpass_filter(z_vals, cutoff_frequency, sampling_rate)

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

    return 'Graph saved', 200


if __name__ == "__main__":
    app.run()
