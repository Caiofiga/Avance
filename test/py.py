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



if __name__ == "__main__":
    app.run()
