const DEFAULT_SETTINGS = {
  apiUrl: "",
  sendMode: "manual"
};

let lastRecording = null;
let isRecording = false;

async function loadSettings() {
  const stored = await chrome.storage.local.get(DEFAULT_SETTINGS);
  return {
    apiUrl: stored.apiUrl || "",
    sendMode: stored.sendMode || "manual"
  };
}

async function ensureOffscreenDocument() {
  if (await chrome.offscreen.hasDocument()) {
    return;
  }

  await chrome.offscreen.createDocument({
    url: "offscreen.html",
    reasons: [chrome.offscreen.Reason.USER_MEDIA],
    justification: "Record audio and video from the active tab."
  });
}

async function startRecording() {
  if (isRecording) {
    return { ok: false, message: "Recording already in progress." };
  }

  try {
    await ensureOffscreenDocument();
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) {
      return { ok: false, message: "No active tab available." };
    }
    lastRecording = null;
    const streamId = await chrome.tabCapture.getMediaStreamId({
      targetTabId: tab.id
    });
    isRecording = true;
    chrome.runtime.sendMessage({ type: "offscreen-start", streamId });
    return { ok: true };
  } catch (error) {
    return { ok: false, message: error.message };
  }
}

async function stopRecording() {
  if (!isRecording) {
    return { ok: false, message: "No recording in progress." };
  }

  chrome.runtime.sendMessage({ type: "offscreen-stop" });
  return { ok: true };
}

async function sendToApi(recording) {
  if (!recording) {
    return { ok: false, message: "No recording available." };
  }

  const { apiUrl } = await loadSettings();
  if (!apiUrl) {
    return { ok: false, message: "API URL is not configured." };
  }

  try {
    const formData = new FormData();
    const blob = new Blob([recording.media], { type: recording.mimeType });
    formData.append("file", blob, "tab-recording.webm");
    formData.append("durationMs", String(recording.durationMs || 0));

    const response = await fetch(apiUrl, {
      method: "POST",
      body: formData
    });

    if (!response.ok) {
      return { ok: false, message: `Upload failed: ${response.status}` };
    }

    return { ok: true };
  } catch (error) {
    return { ok: false, message: error.message };
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "popup-get-state") {
    loadSettings().then((settings) => {
      sendResponse({
        isRecording,
        hasRecording: Boolean(lastRecording),
        apiUrl: settings.apiUrl,
        sendMode: settings.sendMode
      });
    });
    return true;
  }

  if (message.type === "popup-start") {
    startRecording().then(sendResponse);
    return true;
  }

  if (message.type === "popup-stop") {
    stopRecording().then(sendResponse);
    return true;
  }

  if (message.type === "popup-send") {
    sendToApi(lastRecording).then(sendResponse);
    return true;
  }

  if (message.type === "popup-get-recording") {
    if (!lastRecording) {
      sendResponse({ ok: false, message: "No recording available." });
      return true;
    }
    sendResponse({
      ok: true,
      media: lastRecording.media,
      mimeType: lastRecording.mimeType,
      durationMs: lastRecording.durationMs
    });
    return true;
  }

  if (message.type === "popup-save-settings") {
    chrome.storage.local.set({
      apiUrl: message.apiUrl,
      sendMode: message.sendMode
    });
    sendResponse({ ok: true });
    return true;
  }

  if (message.type === "offscreen-recording-ready") {
    lastRecording = {
      media: message.media,
      mimeType: message.mimeType,
      durationMs: message.durationMs
    };
    isRecording = false;

    loadSettings().then((settings) => {
      if (settings.sendMode === "auto") {
        sendToApi(lastRecording).then(() => {
          chrome.runtime.sendMessage({ type: "background-upload-complete" });
        });
      } else {
        chrome.runtime.sendMessage({ type: "background-recording-ready" });
      }
    });
    sendResponse({ ok: true });
    return true;
  }

  if (message.type === "offscreen-error") {
    isRecording = false;
    lastRecording = null;
    chrome.runtime.sendMessage({ type: "background-error", message: message.message });
    sendResponse({ ok: true });
    return true;
  }

  return false;
});
