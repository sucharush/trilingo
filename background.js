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
    requestId: crypto.randomUUID(),
    text: info.selectionText
  };

  try {
    try {
      await chrome.tabs.sendMessage(tab.id, message, { frameId: 0 });
    } catch (error) {
      // Only a missing receiver means the page needs the panel files.
      if (!error.message.includes("Receiving end does not exist")) throw error;

      const target = { tabId: tab.id };
      await chrome.scripting.insertCSS({ target, files: ["panel.css"] });
      await chrome.scripting.executeScript({ target, files: ["content.js"] });
      await chrome.tabs.sendMessage(tab.id, message, { frameId: 0 });
    }

    const result = {
      type: "translation-result",
      requestId: message.requestId
    };

    try {
      // MyMemory accepts at most 500 UTF-8 bytes per selection.
      if (new TextEncoder().encode(message.text).length > 500) {
        result.error = "Text too long. Please select a shorter passage (max 500 bytes).";
      } else {
        const url = new URL("https://api.mymemory.translated.net/get");
        url.search = new URLSearchParams({ q: message.text, langpair: "en|zh" });
        const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = await response.json();
        const translation = data.responseData?.translatedText;
        if (Number(data.responseStatus) !== 200 || data.quotaFinished ||
            typeof translation !== "string" || !translation.trim()) {
          throw new Error("MyMemory did not return a translation.");
        }
        result.text = translation;
      }
    } catch (error) {
      console.error("Trilingual Reader translation failed:", error);
      result.error = "Translation failed. Please try again later.";
    }

    await chrome.tabs.sendMessage(tab.id, result, { frameId: 0 });
  } catch (error) {
    console.error("Trilingual Reader could not show the panel:", error);
  }
});
