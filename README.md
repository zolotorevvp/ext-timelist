# Tab Audio Recorder Extension

Browser extension for recording audio from the currently active tab and sending it to an external API either manually or automatically.

## Features

- Records audio from the selected (active) tab.
- Stores the last recording in memory.
- Supports manual upload or automatic upload after recording completes.
- Configurable API endpoint.

## How it works

1. Click the extension icon to open the popup.
2. Enter the API endpoint that should receive uploads.
3. Choose **Manual send** or **Auto send after recording**.
4. Click **Start recording** while the target tab is active.
5. Click **Stop recording** to finish the capture.
6. If using manual mode, click **Send last recording** to upload.

Uploads are sent as `multipart/form-data` with the file field named `file` and a `durationMs` field.

## Development notes

- `manifest.json` configures a Manifest V3 extension.
- `background.js` manages state, settings, and uploads.
- `offscreen.js` performs the MediaRecorder capture via an offscreen document.
- `popup.html` contains the UI.

Load the folder in Chromium-based browsers via **Extensions → Load unpacked**.
