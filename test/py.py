from flask import Flask
from flask_socketio import SocketIO

app = Flask(__name__)
socketio = SocketIO(app)


@app.route('/')
def index():
    return "Socket.IO server is running"


@socketio.on('message_from_main')
def handle_message(data):
    print('Received data:', data)


if __name__ == '__main__':
    socketio.run(app)
