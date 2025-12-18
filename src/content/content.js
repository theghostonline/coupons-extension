// === Promo‑Code Automation Content Script ===
////////////////////  STATE  ////////////////////

let isSelectionEnabled = false;
let isApplyButtonSelectionEnabled = false;
let isPriceFieldSelectionEnabled = false;
let isRemoveButtonSelectionEnabled = false;

let selectedInputSelector = null;
let applyButtonSelector = null;
let priceFieldSelector = null;
let removeButtonSelector = null;

let automationRunning = false;
let automationIntervalId = null;
let automationIndex = 0;
let automationConfig = {};

let promoCodes = [];
let popularWords = [];
const usedCodes = new Set();

////////////////////  STATUS BROADCAST  ////////////////////

function broadcastStatus() {
  chrome.runtime.sendMessage({
    action: "statusUpdate",
    running: automationRunning,
  });
}

////////////////////  MESSAGE HANDLER  ////////////////////

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  switch (msg.action) {
    case "enableSelection":
      enableSelectionMode("selection");
      break;
    case "enableApplyButtonSelection":
      enableSelectionMode("applyButton");
      break;
    case "enablePriceFieldSelection":
      enableSelectionMode("priceField");
      break;
    case "enableRemoveButtonSelection":
      enableSelectionMode("removeButton");
      break;

    case "applyCodes":
      startAutomation(
        msg.interval,
        msg.applyTimeout,
        msg.length,
        msg.usePopularWords,
        msg.useSpecialCharacters,
        msg.usePopularCodes
      );
      break;

    case "stopAutomation":
      stopAutomation();
      break;

    case "getStatus":
      sendResponse({ running: automationRunning });
      break;

    case "tick":
      if (automationRunning) performAutomationStep();
      break;
  }
  return false;
});

////////////////////  GLOBAL EVENT BLOCKER  ////////////////////

function blockAllEvents(evt) {
  if (
    (isSelectionEnabled ||
      isApplyButtonSelectionEnabled ||
      isPriceFieldSelectionEnabled ||
      isRemoveButtonSelectionEnabled) &&
    !evt.target.matches(
      "input, button, textarea, [contenteditable], div, span, p"
    )
  ) {
    evt.stopImmediatePropagation();
    evt.preventDefault();
  }
}

////////////////////  SELECTION MODE  ////////////////////

function enableSelectionMode(mode) {
  isSelectionEnabled = mode === "selection";
  isApplyButtonSelectionEnabled = mode === "applyButton";
  isPriceFieldSelectionEnabled = mode === "priceField";
  isRemoveButtonSelectionEnabled = mode === "removeButton";

  document.body.style.cursor = mode === "selection" ? "crosshair" : "pointer";

  document.addEventListener("click", blockAllEvents, true);
  document.addEventListener("mousedown", blockAllEvents, true);
  document.addEventListener("mouseup", blockAllEvents, true);
  document.addEventListener("mouseover", highlightElement);
  document.addEventListener("mouseout", unhighlightElement);

  const h = getSelectionHandler(mode);
  if (h) document.addEventListener("click", h, true);
}

function disableSelectionMode() {
  isSelectionEnabled =
    isApplyButtonSelectionEnabled =
    isPriceFieldSelectionEnabled =
    isRemoveButtonSelectionEnabled =
      false;

  document.body.style.cursor = "default";

  document.removeEventListener("click", blockAllEvents, true);
  document.removeEventListener("mousedown", blockAllEvents, true);
  document.removeEventListener("mouseup", blockAllEvents, true);
  document.removeEventListener("mouseover", highlightElement);
  document.removeEventListener("mouseout", unhighlightElement);

  document.removeEventListener("click", selectInputElement, true);
  document.removeEventListener("click", selectApplyButtonElement, true);
  document.removeEventListener("click", selectPriceFieldElement, true);
  document.removeEventListener("click", selectRemoveButtonElement, true);
}

////////////////////  HOVER HIGHLIGHT  ////////////////////

function highlightElement(evt) {
  const el = evt.target;
  if (el.dataset.selected === "true") return;
  el.dataset.prevOutline = el.style.outline;
  el.style.outline = "2px solid red";
}

function unhighlightElement(evt) {
  const el = evt.target;
  if (el.dataset.selected === "true") return;
  restoreOutline(el);
}

////////////////////  OUTLINE HELPERS  ////////////////////

function markElementAsSelected(el, color = "blue") {
  el.dataset.selected = "true";
  el.style.outline = `2px dashed ${color}`;
}
function unmarkPrevious(selector) {
  if (!selector) return;
  const prev = document.querySelector(selector);
  if (prev) {
    delete prev.dataset.selected;
    prev.style.outline = "";
  }
}
function restoreOutline(el) {
  if (el.dataset.prevOutline !== undefined) {
    el.style.outline = el.dataset.prevOutline;
    delete el.dataset.prevOutline;
  } else el.style.outline = "";
}

////////////////////  SELECTION HANDLERS  ////////////////////

function selectInputElement(evt) {
  if (!isSelectionEnabled) return;
  evt.preventDefault();
  evt.stopImmediatePropagation();

  const el = evt.target;
  if (
    el.tagName.toLowerCase() === "input" ||
    el.tagName.toLowerCase() === "textarea" ||
    el.isContentEditable
  ) {
    unmarkPrevious(selectedInputSelector);
    selectedInputSelector = getElementSelector(el);
    markElementAsSelected(el, "blue");
    disableSelectionMode();
  } else {
    alert("Please select a valid input field.");
    restoreOutline(el);
  }
}
function selectApplyButtonElement(evt) {
  if (!isApplyButtonSelectionEnabled) return;
  evt.preventDefault();
  evt.stopImmediatePropagation();
  const el = evt.target;
  unmarkPrevious(applyButtonSelector);
  applyButtonSelector = getElementSelector(el);
  markElementAsSelected(el, "orange");
  disableSelectionMode();
}
function selectPriceFieldElement(evt) {
  if (!isPriceFieldSelectionEnabled) return;
  evt.preventDefault();
  evt.stopImmediatePropagation();
  const el = evt.target;
  unmarkPrevious(priceFieldSelector);
  priceFieldSelector = getElementSelector(el);
  markElementAsSelected(el, "green");
  disableSelectionMode();
}
function selectRemoveButtonElement(evt) {
  if (!isRemoveButtonSelectionEnabled) return;
  evt.preventDefault();
  evt.stopImmediatePropagation();
  const el = evt.target;
  unmarkPrevious(removeButtonSelector);
  removeButtonSelector = getElementSelector(el);
  markElementAsSelected(el, "purple");
  disableSelectionMode();
}

////////////////////  UTILS  ////////////////////

function getElementSelector(el) {
  if (el.id) return `#${el.id}`;
  if (el.className) return `.${Array.from(el.classList).join(".")}`;
  return el.tagName.toLowerCase();
}
function getSelectionHandler(mode) {
  switch (mode) {
    case "selection":
      return selectInputElement;
    case "applyButton":
      return selectApplyButtonElement;
    case "priceField":
      return selectPriceFieldElement;
    case "removeButton":
      return selectRemoveButtonElement;
    default:
      return null;
  }
}

////////////////////  DATA LOAD  ////////////////////

async function loadInitialData() {
  try {
    const pc = await fetch(chrome.runtime.getURL("data/promo-codes.json")).then(
      (r) => r.json()
    );
    promoCodes = pc.promoCodes || [];
    const pw = await fetch(
      chrome.runtime.getURL("data/popular-words.json")
    ).then((r) => r.json());
    popularWords = pw.popularWords || [];
  } catch (err) {
    console.error("Data load error:", err);
    alert("Failed to load initial data.");
  }
}

////////////////////  AUTOMATION  ////////////////////

function startAutomation(
  interval = 100,
  applyTimeout = 100,
  length = 6,
  usePopularWords = true,
  useSpecialChars = false,
  usePopularCodes = true
) {
  if (automationRunning) {
    alert("Automation already running.");
    return;
  }

  if (!selectedInputSelector || !applyButtonSelector || !priceFieldSelector) {
    alert("Select input, apply button, and price field first.");
    return;
  }
  if (promoCodes.length === 0 && usePopularCodes) {
    alert("No promo codes found.");
    return;
  }

  automationConfig = {
    interval,
    applyTimeout,
    length,
    usePopularWords,
    useSpecialChars,
    usePopularCodes,
  };

  automationRunning = true;
  broadcastStatus();

  // Start background timer
  chrome.runtime.sendMessage({
    action: "startBackgroundTimer",
    interval: interval,
  });
}

function performAutomationStep() {
  if (!automationRunning) return;

  const input = document.querySelector(selectedInputSelector);
  const btn = document.querySelector(applyButtonSelector);
  const price = document.querySelector(priceFieldSelector);

  if (!input || !btn || !price) {
    alert("A selected element is missing.");
    stopAutomation();
    return;
  }

  const originalPrice = price.textContent.trim();

  const shouldUseList =
    automationConfig.usePopularCodes && automationIndex < promoCodes.length;
  const code = shouldUseList
    ? promoCodes[automationIndex]
    : generateUniquePromoCode(
        automationConfig.length,
        automationConfig.usePopularWords,
        automationConfig.useSpecialChars,
        popularWords
      );

  setNewPromoCode(input, code);
  btn.click();
  usedCodes.add(code);

  setTimeout(() => {
    const newPrice = price.textContent.trim();
    if (newPrice !== originalPrice) {
      stopAutomation();
      alert("Promo code applied successfully.");
    } else {
      const rm = removeButtonSelector
        ? document.querySelector(removeButtonSelector)
        : null;
      if (rm) rm.click();
      automationIndex++;
    }
  }, automationConfig.applyTimeout);
}

function stopAutomation() {
  if (!automationRunning) {
    alert("Automation is not running.");
    return;
  }
  automationRunning = false;
  chrome.runtime.sendMessage({ action: "stopBackgroundTimer" });
  broadcastStatus();
}

////////////////////  CODE GENERATOR  ////////////////////

function generateUniquePromoCode(len, usePopular, useSpecial, words) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const specials = "!@#$%^&*_-+=";
  let code = "";

  if (usePopular && words.length) {
    const word = words[Math.floor(Math.random() * words.length)];
    const mult = Math.floor(Math.random() * 19); // 0..18
    if (mult === 0) {
      code = word;
    } else {
      const num = mult * 5; // 5..90
      code = Math.random() < 0.05 ? num + word : word + num;
    }
  } else {
    const alphabet = useSpecial ? chars + specials : chars;
    for (let i = 0; i < len; i++)
      code += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
  }
  return usedCodes.has(code)
    ? generateUniquePromoCode(len, usePopular, useSpecial, words)
    : code;
}

////////////////////  DOM VALUE SETTER  ////////////////////

function setNewPromoCode(el, code) {
  if (el.tagName.toLowerCase() === "textarea") {
    el.textContent = code;
  } else {
    el.value = code;
  }
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

////////////////////  INIT  ////////////////////

loadInitialData();
