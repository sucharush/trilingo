chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "trilingual-reader",
    title: "Trilingual Reader",
    contexts: ["selection"],
    documentUrlPatterns: ["http://*/*", "https://*/*"]
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== "trilingual-reader" || !tab?.id) return;

  const message = {
    type: "show-selection",
    text: info.selectionText
  };

  try {
    try {
      await chrome.tabs.sendMessage(tab.id, message, { frameId: 0 });
      return;
    } catch (error) {
      // Only a missing receiver means the page needs the panel files.
      if (!error.message.includes("Receiving end does not exist")) throw error;
    }

    const target = { tabId: tab.id };
    await chrome.scripting.insertCSS({ target, files: ["panel.css"] });
    await chrome.scripting.executeScript({ target, files: ["content.js"] });
    await chrome.tabs.sendMessage(tab.id, message, { frameId: 0 });
  } catch (error) {
    console.error("Trilingual Reader could not show the panel:", error);
  }
});
