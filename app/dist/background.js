// src/background.ts
chrome.action.onClicked.addListener(() => {
  const url = chrome.runtime.getURL("app.html");
  void chrome.tabs.create({ url });
});
