const statusEl = document.getElementById("status");
const apiInput = document.getElementById("api-url");
const startBtn = document.getElementById("start");
const stopBtn = document.getElementById("stop");
const sendBtn = document.getElementById("send");
const previewBtn = document.getElementById("preview");
const previewSection = document.getElementById("preview-section");
const previewAudio = document.getElementById("preview-audio");
const sendModeInputs = document.querySelectorAll("input[name='send-mode']");
let previewUrl = null;

function setStatus(message) {
  statusEl.textContent = message;
}

function setButtons({ isRecording, hasRecording }) {
  startBtn.disabled = isRecording;
  stopBtn.disabled = !isRecording;
  sendBtn.disabled = !hasRecording;
  previewBtn.disabled = !hasRecording;
}

function getSelectedSendMode() {
  const selected = Array.from(sendModeInputs).find((input) => input.checked);
  return selected ? selected.value : "manual";
}

function updateSettings() {
  chrome.runtime.sendMessage({
    type: "popup-save-settings",
    apiUrl: apiInput.value.trim(),
    sendMode: getSelectedSendMode()
  });
}

async function init() {
  chrome.runtime.sendMessage({ type: "popup-get-state" }, (state) => {
    if (!state) {
      setStatus("Unable to load state.");
      return;
    }

    apiInput.value = state.apiUrl || "";
    sendModeInputs.forEach((input) => {
      input.checked = input.value === state.sendMode;
    });
    setButtons(state);
    setStatus(state.isRecording ? "Recording in progress..." : "Idle.");
    previewSection.classList.toggle("hidden", !state.hasRecording);
  });
}

startBtn.addEventListener("click", () => {
  setStatus("Starting recording...");
  previewSection.classList.add("hidden");
  if (previewUrl) {
    URL.revokeObjectURL(previewUrl);
    previewUrl = null;
  }
  previewAudio.removeAttribute("src");
  chrome.runtime.sendMessage({ type: "popup-start" }, (response) => {
    if (!response?.ok) {
      setStatus(response?.message || "Unable to start recording.");
      return;
    }
    setButtons({ isRecording: true, hasRecording: false });
    setStatus("Recording in progress...");
  });
});

stopBtn.addEventListener("click", () => {
  setStatus("Stopping recording...");
  chrome.runtime.sendMessage({ type: "popup-stop" }, (response) => {
    if (!response?.ok) {
      setStatus(response?.message || "Unable to stop recording.");
      return;
    }
    setButtons({ isRecording: false, hasRecording: true });
  });
});

sendBtn.addEventListener("click", () => {
  setStatus("Sending recording...");
  chrome.runtime.sendMessage({ type: "popup-send" }, (response) => {
    if (!response?.ok) {
      setStatus(response?.message || "Upload failed.");
      return;
    }
    setStatus("Upload complete.");
  });
});

previewBtn.addEventListener("click", () => {
  setStatus("Loading preview...");
  chrome.runtime.sendMessage({ type: "popup-get-recording" }, (response) => {
    if (!response?.ok) {
      setStatus(response?.message || "Unable to load preview.");
      return;
    }
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    const blob = new Blob([response.audio], { type: response.mimeType });
    previewUrl = URL.createObjectURL(blob);
    previewAudio.src = previewUrl;
    previewSection.classList.remove("hidden");
    setStatus("Preview ready.");
  });
});

apiInput.addEventListener("change", updateSettings);
apiInput.addEventListener("blur", updateSettings);
sendModeInputs.forEach((input) => {
  input.addEventListener("change", updateSettings);
});

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "background-recording-ready") {
    setButtons({ isRecording: false, hasRecording: true });
    setStatus("Recording ready to send.");
    previewSection.classList.remove("hidden");
  }

  if (message.type === "background-upload-complete") {
    setButtons({ isRecording: false, hasRecording: true });
    setStatus("Upload complete.");
    previewSection.classList.remove("hidden");
  }

  if (message.type === "background-error") {
    setButtons({ isRecording: false, hasRecording: false });
    setStatus(message.message || "Recording failed.");
    previewSection.classList.add("hidden");
  }
});

init();
