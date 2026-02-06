let mediaRecorder = null;
let recordedChunks = [];
let captureStream = null;
let startTimestamp = null;
let monitoringAudio = null;
const preferredMimeTypes = [
  "video/webm;codecs=vp9,opus",
  "video/webm;codecs=vp8,opus",
  "video/webm"
];

function resetRecording() {
  mediaRecorder = null;
  recordedChunks = [];
  captureStream = null;
  startTimestamp = null;
  if (monitoringAudio) {
    monitoringAudio.pause();
    monitoringAudio.srcObject = null;
    monitoringAudio = null;
  }
}

async function startCapture(streamId) {
  if (mediaRecorder) {
    return;
  }

  try {
    if (!streamId) {
      throw new Error("Missing stream ID for tab capture.");
    }
    captureStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        mandatory: {
          chromeMediaSource: "tab",
          chromeMediaSourceId: streamId
        }
      },
      video: {
        mandatory: {
          chromeMediaSource: "tab",
          chromeMediaSourceId: streamId
        }
      }
    });

    monitoringAudio = new Audio();
    monitoringAudio.srcObject = captureStream;
    monitoringAudio.volume = 1;
    monitoringAudio.play().catch(() => {});

    recordedChunks = [];
    startTimestamp = Date.now();

    const mimeType = preferredMimeTypes.find((type) =>
      MediaRecorder.isTypeSupported(type)
    );
    const recorderOptions = mimeType ? { mimeType } : undefined;
    mediaRecorder = new MediaRecorder(captureStream, recorderOptions);

    mediaRecorder.addEventListener("dataavailable", (event) => {
      if (event.data.size > 0) {
        recordedChunks.push(event.data);
      }
    });

    mediaRecorder.addEventListener("stop", async () => {
      const blob = new Blob(recordedChunks, {
        type: mediaRecorder?.mimeType || "video/webm"
      });
      const arrayBuffer = await blob.arrayBuffer();
      const durationMs = startTimestamp ? Date.now() - startTimestamp : 0;
      chrome.runtime.sendMessage({
        type: "offscreen-recording-ready",
        media: arrayBuffer,
        mimeType: blob.type,
        durationMs
      });

      if (captureStream) {
        captureStream.getTracks().forEach((track) => track.stop());
      }
      resetRecording();
    });

    mediaRecorder.start();
  } catch (error) {
    chrome.runtime.sendMessage({ type: "offscreen-error", message: error.message });
    resetRecording();
  }
}

function stopCapture() {
  if (!mediaRecorder) {
    return;
  }
  mediaRecorder.stop();
}

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "offscreen-start") {
    startCapture(message.streamId);
  }

  if (message.type === "offscreen-stop") {
    stopCapture();
  }
});
