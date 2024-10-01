
const socket = new WebSocket('ws://localhost:6789');

socket.onopen = function(e) {
    console.log('[open] Connection established');
};

socket.onmessage = function(event) {
    //console.log(`[message] Data received from server: ${event.data}`);

    try {
        let displacement = JSON.parse(event.data);  // Receive and parse {dx, dy} from the server
        let deltaX = displacement.dx;
        handleMovement(deltaX);  // Trigger the movement in the game logic
    } catch (err) {
        console.error('Error parsing message data:', err);
    }
};

socket.onclose = function(event) {
    if (event.wasClean) {
        console.log(`[close] Connection closed cleanly, code=${event.code} reason=${event.reason}`);
    } else {
        console.log('[close] Connection died');
    }
};

socket.onerror = function(event) {
    console.error('[error] WebSocket error observed:', event);
};

// Expose a method to interact with the game logic
function sendToServer(message) {
    if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(message));
    }
}
