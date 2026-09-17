# Avance

Browser-based upper-limb rehabilitation games driven by **markerless camera motion
capture** and a **wearable IMU**. The player moves their arm in front of a webcam to
control the game; an ESP32 strapped to the limb streams accelerometer and gyroscope
data in parallel. Each session is rendered as a filtered motion graph for later review.

Built with Flask + Socket.IO, MediaPipe (hands + pose), and an ESP32 running FastIMU.

---

## How it works

`maincode.py` runs three things concurrently in one process:

```
                    ┌─────────────────────────────────────┐
  webcam  ──────────▶ process_video()  (daemon thread)    │
                    │   MediaPipe Hands → wrist position  │
                    │   MediaPipe Pose  → arm flexion ∠   │
                    │   EMA smoothing, Δ from frame centre│
                    └──────────────┬──────────────────────┘
                                   │ displacement_queue
                    ┌──────────────▼──────────────────────┐
                    │ asyncio websocket  localhost:6789   │──▶ browser Web Worker
                    │   broadcaster() fans out {dx, dy}   │    (movement input)
                    └─────────────────────────────────────┘

                    ┌─────────────────────────────────────┐
                    │ Flask + Socket.IO   0.0.0.0:5000    │──▶ pages, auth, graphs
                    └─────────────────────────────────────┘

  ESP32 + MPU6500 ──────── ws://<esp-ip>/ws ──────────────────▶ browser Web Worker
                           {accelX..Z, gyroX..Z}               (IMU telemetry)
```

The browser talks to **two** WebSocket sources: `localhost:6789` for camera-derived
movement, and the ESP32 directly for IMU data. The ESP32's address is entered at
runtime, not hardcoded.

When a game ends the page POSTs its recorded series to `/save_graph1` or
`/save_graph2`. The backend applies a Butterworth low-pass filter (`scipy`), plots it
with matplotlib, and writes a PNG into `Graphs/Game1/` or `Graphs/Game2/`.
`/latest_graphs` returns the most recent of each, base64-encoded.

---

## Hardware

| Part | Notes |
|---|---|
| ESP32 dev board | `esp32:esp32:esp32doit-devkit-v1` (see `.vscode/arduino.json`) |
| MPU6500 IMU | I²C address `0x68`, 400 kHz bus |
| Status LED | GPIO 13 — lights once Wi-Fi is connected |
| Webcam | OpenCV capture device `0` |

Arduino libraries: `WiFi`, `ESPAsyncWebServer`, `AsyncWebSocket`, `FastIMU`, `Wire`.

### Flashing and pairing the ESP32

1. Flash `MrPython.ino`.
2. On boot it starts a SoftAP — SSID `ESP32_Setup`, password `12345678`.
3. Join that AP and open `http://192.168.4.1/` to submit your Wi-Fi SSID/password.
4. It joins your network and `/status` reports its IP and WebSocket URL.
5. Give that address to the game page when prompted.

---

## Running the server

`mediapipe` only publishes wheels for a limited set of Python minor versions. If pip
cannot resolve it on your default interpreter, create the venv with an older one
(`python3.11 -m venv .venv`).

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python maincode.py
```

Then open <http://localhost:5000>.

The camera WebSocket binds to `localhost`, so the browser must run on the same
machine as the server. Flask itself listens on `0.0.0.0:5000`.

---

## Routes

| Route | Purpose |
|---|---|
| `/` | Home |
| `/register`, `/login`, `/logout` | Flask-Login auth, users stored in `users.txt` |
| `/calibration` | Required before either game; GET renders, POST stores to session |
| `/testgame` | **Regador** (watering can) — calibration-gated |
| `/estilingue` | **Estilingue** (slingshot) — calibration-gated |
| `/save_graph1`, `/save_graph2` | Accept session series, render the PNG |
| `/latest_graphs` | Latest graph from each game, base64 |
| `/admin` | Live telemetry view (login required) |
| `/endgame` | Post-session summary — **template missing, see below** |

Both games are wrapped in `@need_calibration`, which redirects to `/calibration`
unless `session['calibration_data']` is set. Calibration covers two axes: reach
**distance** and arm **angle**.

### The games

- **Regador** (`/testgame`, `testgamelogic.js` + `webhooks-regador.js`) — move a
  watering can across a row of plants using camera-tracked hand displacement.
  Overlap intervals per plant are recorded and marked on the output graph.
- **Estilingue** (`/estilingue`, `estilingue.js` + `webhooks-estilingue.js`) —
  a Matter.js physics slingshot; draw and release using tracked arm movement.

Frontend libraries are pulled from CDN: Bootstrap 5.3, Matter.js, Dygraph, D3 7,
socket.io, jsPDF, tsParticles confetti.

---

## Layout

```
maincode.py           Flask app, camera pipeline, websocket bridge, graph rendering
MrPython.ino          ESP32 firmware — SoftAP provisioning + IMU streaming
requirements.txt      Python deps (incomplete, see below)
templates/            Jinja pages
static/js/            Game logic, websocket workers, charting
static/css, img/      Styling and assets
Graphs/Game1, Game2/  Rendered session graphs (PNG, UUID-named)
users.txt             Flat-file user store
```

---
