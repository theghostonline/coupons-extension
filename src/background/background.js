const intervals = {};

chrome.runtime.onInstalled.addListener(() => {
  console.log("Promo Code Extension installed.");
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "statusUpdate") {
    const tabId = sender.tab ? sender.tab.id : null;
    if (tabId) {
      if (message.running) {
        chrome.action.setBadgeText({ text: "ON", tabId: tabId });
        chrome.action.setBadgeBackgroundColor({
          color: "#4caf50",
          tabId: tabId,
        });
      } else {
        chrome.action.setBadgeText({ text: "", tabId: tabId });
      }
    }
  } else if (message.action === "startBackgroundTimer") {
    const tabId = sender.tab.id;
    if (intervals[tabId]) clearInterval(intervals[tabId]);

    intervals[tabId] = setInterval(() => {
      chrome.tabs.sendMessage(tabId, { action: "tick" }).catch((err) => {
        // If tab is closed or error, stop timer
        clearInterval(intervals[tabId]);
        delete intervals[tabId];
      });
    }, message.interval);
  } else if (message.action === "stopBackgroundTimer") {
    const tabId = sender.tab ? sender.tab.id : null;
    if (tabId && intervals[tabId]) {
      clearInterval(intervals[tabId]);
      delete intervals[tabId];
    }
  }
});
