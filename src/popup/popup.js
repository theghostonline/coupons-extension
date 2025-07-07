// === popup.js ===

////////////////////  HELPERS  ////////////////////

/**
 * Sends a message to the active tab and optionally handles the async response.
 * @param {object} msg
 * @param {(resp:any)=>void} [cb]
 */
function sendToActiveTab(msg, cb) {
  chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    if (!tab) return;
    chrome.tabs.sendMessage(tab.id, msg, cb);
  });
}

/** Updates button label / color to reflect running state. */
function refreshUI(running) {
  automationRunning = running; // keep local flag in sync
  if (running) {
    startButton.innerHTML = "Stop Automation";
    startButton.style.backgroundColor = "#dc3545";
  } else {
    startButton.innerHTML = "Start Automation";
    startButton.style.backgroundColor = "#6366f1";
  }
}

////////////////////  DOM HOOKS  ////////////////////

// Selection buttons
document.getElementById("select-input").addEventListener("click", () => {
  sendToActiveTab({ action: "enableSelection" });
  window.close();
});

document.getElementById("select-apply-button").addEventListener("click", () => {
  sendToActiveTab({ action: "enableApplyButtonSelection" });
  window.close();
});

document.getElementById("select-price-field").addEventListener("click", () => {
  sendToActiveTab({ action: "enablePriceFieldSelection" });
  window.close();
});

document
  .getElementById("select-remove-button")
  .addEventListener("click", () => {
    sendToActiveTab({ action: "enableRemoveButtonSelection" });
    window.close();
  });

// Start / Stop button
const startButton = document.getElementById("start-automation");
let automationRunning = false; // local shadow copy

startButton.addEventListener("click", () => {
  if (automationRunning) {
    // --- Send STOP ---
    sendToActiveTab({ action: "stopAutomation" }, () => refreshUI(false));
  } else {
    // --- Send START ---
    sendToActiveTab(
      {
        action: "applyCodes",
        interval: parseInt(document.getElementById("interval").value, 10),
        applyTimeout: parseInt(
          document.getElementById("apply-timeout").value,
          10
        ),
        length: parseInt(document.getElementById("length").value, 10),
        usePopularCodes: document.getElementById("use-popular-codes").checked, // NEW
        usePopularWords: document.getElementById("use-popular-words").checked,
        useSpecialCharacters: document.getElementById("use-special-characters")
          .checked,
      },
      () => refreshUI(true)
    );
  }
});

// Live status updates while popup is open
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.action === "statusUpdate") refreshUI(msg.running);
});

////////////////////  SETTINGS PERSISTENCE  ////////////////////

function saveSettings() {
  chrome.storage.sync.set(
    {
      interval: document.getElementById("interval").value,
      applyTimeout: document.getElementById("apply-timeout").value,
      length: document.getElementById("length").value,
      usePopularCodes: document.getElementById("use-popular-codes").checked,
      usePopularWords: document.getElementById("use-popular-words").checked,
      useSpecialCharacters: document.getElementById("use-special-characters")
        .checked,
    },
    () => console.log("Settings saved.")
  );
}

document.getElementById("interval").addEventListener("input", saveSettings);
document
  .getElementById("apply-timeout")
  .addEventListener("input", saveSettings);
document.getElementById("length").addEventListener("input", saveSettings);
document
  .getElementById("use-popular-words")
  .addEventListener("change", saveSettings);
document
  .getElementById("use-special-characters")
  .addEventListener("change", saveSettings);
document
  .getElementById("use-popular-codes")
  .addEventListener("change", saveSettings);

function loadSettings() {
  chrome.storage.sync.get(
    {
      interval: "1000",
      applyTimeout: "500",
      length: "6",
      usePopularCodes: true,
      usePopularWords: true,
      useSpecialCharacters: false,
    },
    (s) => {
      document.getElementById("interval").value = s.interval;
      document.getElementById("apply-timeout").value = s.applyTimeout;
      document.getElementById("length").value = s.length;
      document.getElementById("use-popular-codes").checked = s.usePopularCodes;
      document.getElementById("use-popular-words").checked = s.usePopularWords;
      document.getElementById("use-special-characters").checked =
        s.useSpecialCharacters;
    }
  );
}

////////////////////  INIT  ////////////////////

document.addEventListener("DOMContentLoaded", () => {
  loadSettings();

  // Ask content‑script whether automation is running, so UI is correct even
  // if user closed and reopened the popup.
  sendToActiveTab({ action: "getStatus" }, (resp) =>
    refreshUI(Boolean(resp?.running))
  );
});
