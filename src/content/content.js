// === Promo‑Code Automation Content Script ===
let isSelectionEnabled = false;
let isApplyButtonSelectionEnabled = false;
let isPriceFieldSelectionEnabled = false;
let isRemoveButtonSelectionEnabled = false;

let selectedInputSelector = null;
let applyButtonSelector = null;
let priceFieldSelector = null;
let removeButtonSelector = null;

let automationRunning = false;
let promoCodes = [];
let popularWords = [];
const usedCodes = new Set();

// ---------- Message Handling ----------
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.action) {
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
        message.interval,
        message.applyTimeout,
        message.length,
        message.usePopularWords,
        message.useSpecialCharacters
      );
      break;
    case "stopAutomation":
      stopAutomation();
      break;
  }
});

// ---------- Global Event Blocker ----------
function blockAllEvents(event) {
  if (
    (isSelectionEnabled ||
      isApplyButtonSelectionEnabled ||
      isPriceFieldSelectionEnabled ||
      isRemoveButtonSelectionEnabled) &&
    !event.target.matches(
      "input, button, textarea, [contenteditable], div, span, p"
    )
  ) {
    event.stopImmediatePropagation();
    event.preventDefault();
  }
}

// ---------- Selection Mode ----------
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

  const selectionHandler = getSelectionHandler(mode);
  if (selectionHandler) {
    document.addEventListener("click", selectionHandler, true);
  }
}

function disableSelectionMode() {
  isSelectionEnabled = false;
  isApplyButtonSelectionEnabled = false;
  isPriceFieldSelectionEnabled = false;
  isRemoveButtonSelectionEnabled = false;

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

// ---------- Hover Highlighting ----------
function highlightElement(event) {
  const element = event.target;
  // Skip permanent selections
  if (element.dataset.selected === "true") return;

  // Store existing outline so we can restore it on mouseout
  element.dataset.prevOutline = element.style.outline;
  element.style.outline = "2px solid red";
}

function unhighlightElement(event) {
  const element = event.target;
  // Keep outline for permanently selected elements
  if (element.dataset.selected === "true") return;

  // Restore previous outline if one was saved
  if (element.dataset.prevOutline !== undefined) {
    element.style.outline = element.dataset.prevOutline;
    delete element.dataset.prevOutline;
  } else {
    element.style.outline = "";
  }
}

// ---------- Permanent Selection Helpers ----------
/**
 * Adds a dashed outline of given color and marks the element as permanently selected.
 * @param {HTMLElement} element
 * @param {string} color
 */
function markElementAsSelected(element, color = "blue") {
  element.dataset.selected = "true";
  element.style.outline = `2px dashed ${color}`;
}

/**
 * Removes permanent selection outline from a previously selected element.
 * @param {string|null} selector
 */
function unmarkPrevious(selector) {
  if (!selector) return;
  const prev = document.querySelector(selector);
  if (prev) {
    delete prev.dataset.selected;
    prev.style.outline = "";
  }
}

// ---------- Selection Handlers ----------
function selectInputElement(event) {
  if (!isSelectionEnabled) return;

  event.preventDefault();
  event.stopImmediatePropagation();

  const element = event.target;

  if (element.tagName.toLowerCase() === "input" || element.isContentEditable) {
    unmarkPrevious(selectedInputSelector);
    selectedInputSelector = getElementSelector(element);
    markElementAsSelected(element, "blue");
  } else {
    alert("Please select a valid input field.");
  }

  disableSelectionMode();
}

function selectApplyButtonElement(event) {
  if (!isApplyButtonSelectionEnabled) return;

  event.preventDefault();
  event.stopImmediatePropagation();

  const element = event.target;
  unmarkPrevious(applyButtonSelector);
  applyButtonSelector = getElementSelector(element);
  markElementAsSelected(element, "orange");

  disableSelectionMode();
}

function selectPriceFieldElement(event) {
  if (!isPriceFieldSelectionEnabled) return;

  event.preventDefault();
  event.stopImmediatePropagation();

  const element = event.target;
  unmarkPrevious(priceFieldSelector);
  priceFieldSelector = getElementSelector(element);
  markElementAsSelected(element, "green");

  disableSelectionMode();
}

function selectRemoveButtonElement(event) {
  if (!isRemoveButtonSelectionEnabled) return;

  event.preventDefault();
  event.stopImmediatePropagation();

  const element = event.target;
  unmarkPrevious(removeButtonSelector);
  removeButtonSelector = getElementSelector(element);
  markElementAsSelected(element, "purple");

  disableSelectionMode();
}

// ---------- Utility ----------
function getElementSelector(element) {
  if (element.id) return `#${element.id}`;
  if (element.className) return `.${Array.from(element.classList).join(".")}`;
  return element.tagName.toLowerCase();
}

// ---------- Initial Data Load ----------
async function loadInitialData() {
  try {
    const promoCodesResponse = await fetch(
      chrome.runtime.getURL("data/promo-codes.json")
    );
    const promoCodesData = await promoCodesResponse.json();
    promoCodes = promoCodesData.promoCodes || [];

    const popularWordsResponse = await fetch(
      chrome.runtime.getURL("data/popular-words.json")
    );
    const popularWordsData = await popularWordsResponse.json();
    popularWords = popularWordsData.popularWords || [];
  } catch (error) {
    console.error("Error loading data:", error);
    alert("Failed to load initial data.");
  }
}

// ---------- Handler Factory ----------
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

// ---------- Automation ----------
function startAutomation(
  interval = 100,
  applyTimeout = 100,
  length = 6,
  usePopularWords = true,
  useSpecialCharacters = false
) {
  if (!selectedInputSelector || !applyButtonSelector || !priceFieldSelector) {
    alert(
      "Please select an input field, an apply button, and a price field before starting the automation."
    );
    return;
  }

  if (promoCodes.length === 0) {
    alert("No promo codes found.");
    return;
  }

  let originalPrice;
  let index = 0;
  automationRunning = true;

  const automationInterval = setInterval(() => {
    if (!automationRunning) {
      clearInterval(automationInterval);
      return;
    }

    const selectedElement = document.querySelector(selectedInputSelector);
    const applyButton = document.querySelector(applyButtonSelector);
    const priceField = document.querySelector(priceFieldSelector);

    if (!selectedElement || !applyButton || !priceField) {
      alert("One of the selected elements is missing on the page.");
      automationRunning = false;
      clearInterval(automationInterval);
      return;
    }

    originalPrice = priceField.textContent.trim();

    let currentCode;
    if (index < promoCodes.length) {
      currentCode = promoCodes[index];
    } else {
      currentCode = generateUniquePromoCode(
        length,
        usePopularWords,
        useSpecialCharacters,
        popularWords
      );
    }

    setNewPromoCode(selectedElement, currentCode);
    applyButton.click();
    usedCodes.add(currentCode);

    setTimeout(() => {
      const currentPrice = priceField.textContent.trim();
      if (currentPrice !== originalPrice) {
        automationRunning = false;
        clearInterval(automationInterval);
        alert("Promo code applied successfully.");
      } else {
        const removeButton = removeButtonSelector
          ? document.querySelector(removeButtonSelector)
          : null;
        if (removeButton) {
          removeButton.click();
        }
        index++;
      }
    }, applyTimeout);
  }, interval);
}

function stopAutomation() {
  if (automationRunning) {
    automationRunning = false;
  } else {
    alert("Automation is not running.");
  }
}

// ---------- Promo Code Generator ----------
function generateUniquePromoCode(
  length,
  usePopularWords,
  useSpecialCharacters,
  popularWords
) {
  const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const specials = "!@#$%^&*_-+=";

  let generatedCode = "";

  if (usePopularWords) {
    const word = popularWords[Math.floor(Math.random() * popularWords.length)];

    // Random multiple of 5 between 0 and 90 (0 means no digit)
    const randomMultiple = Math.floor(Math.random() * 19);

    if (randomMultiple === 0) {
      generatedCode = word;
    } else {
      const randomDigit = randomMultiple * 5;
      const position = Math.random() < 0.05 ? "before" : "after"; // 5% chance before
      generatedCode =
        position === "before" ? randomDigit + word : word + randomDigit;
    }
  } else {
    const allCharacters = useSpecialCharacters
      ? characters + specials
      : characters;

    for (let i = 0; i < length; i++) {
      generatedCode += allCharacters.charAt(
        Math.floor(Math.random() * allCharacters.length)
      );
    }
  }

  // Ensure uniqueness
  if (usedCodes.has(generatedCode)) {
    return generateUniquePromoCode(
      length,
      usePopularWords,
      useSpecialCharacters,
      popularWords
    );
  }

  return generatedCode;
}

// ---------- DOM Value Setter ----------
function setNewPromoCode(element, promoCode) {
  element.value = promoCode;
  element.dispatchEvent(new Event("input", { bubbles: true }));
}

// ---------- Initialization ----------
loadInitialData();
