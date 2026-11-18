chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "trilingual-reader",
    title: "Trilingual Reader",
    contexts: ["selection"],
    documentUrlPatterns: ["http://*/*", "https://*/*"]
  });
});

function limitText(text) {
  const encoder = new TextEncoder();
  let end = 0;
  let bytes = 0;

  // Keep the longest prefix that fits, without breaking a surrogate pair.
  for (const character of text) {
    const size = encoder.encode(character).length;
    if (bytes + size > 500) break;
    end += character.length;
    bytes += size;
  }
  return { text: text.slice(0, end), bytes, shortened: end < text.length };
}

async function translate(text, source, target, onShortened) {
  const limited = limitText(text);
  const notice = limited.shortened
    ? `Only the first ${limited.bytes} UTF-8 bytes are included in this translation (MyMemory limit: 500 bytes per request). The remaining text is omitted.`
    : "";
  if (notice) await onShortened("Translating...", notice);

  try {
    const url = new URL("https://api.mymemory.translated.net/get");
    url.search = new URLSearchParams({ q: limited.text, langpair: `${source}|${target}` });
    const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    const translation = data.responseData?.translatedText;
    if (Number(data.responseStatus) !== 200 || data.quotaFinished ||
        typeof translation !== "string" || !translation.trim()) {
      throw new Error("MyMemory did not return a translation.");
    }
    return { text: translation, notice };
  } catch (error) {
    console.error("Trilingual Reader translation failed:", error);
    const failure = new Error("Translation failed. Please try again later.");
    failure.notice = notice;
    throw failure;
  }
}

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

    const update = (stage, state, text, sourceLanguage, notice = "") => chrome.tabs.sendMessage(tab.id, {
      type: "translation-update",
      requestId: message.requestId,
      stage,
      state,
      text,
      sourceLanguage,
      notice
    }, { frameId: 0 });

    let sourceLanguage;
    try {
      const detection = await chrome.i18n.detectLanguage(message.text);
      const candidates = [...(detection.languages || [])].sort((a, b) => b.percentage - a.percentage);
      sourceLanguage = candidates[0]?.language;
      if (!detection.isReliable || !sourceLanguage || sourceLanguage === "und") {
        throw new Error("Unreliable or unknown source language.");
      }
    } catch (error) {
      console.error("Trilingual Reader language detection failed:", error);
      await update("english", "error", "Could not reliably detect the language. Select a longer passage in one language.");
      await update("chinese", "pending", "Not translated because English is unavailable.");
      return;
    }

    await update("english", "loading", "Translating...", sourceLanguage);
    let englishResult;
    try {
      // English needs no same-language API request; keep both sections visible.
      englishResult = sourceLanguage === "en" ? { text: message.text, notice: "" }
        : await translate(message.text, sourceLanguage, "en",
          (text, notice) => update("english", "loading", text, undefined, notice));
    } catch (error) {
      await update("english", "error", error.message, undefined, error.notice);
      await update("chinese", "pending", "Not translated because English is unavailable.");
      return;
    }

    await update("english", "ready", englishResult.text, undefined, englishResult.notice);
    await update("chinese", "loading", "Translating...");
    let chineseResult;
    try {
      chineseResult = await translate(englishResult.text, "en", "zh",
        (text, notice) => update("chinese", "loading", text, undefined, notice));
    } catch (error) {
      await update("chinese", "error", error.message, undefined, error.notice);
      return;
    }
    await update("chinese", "ready", chineseResult.text, undefined, chineseResult.notice);
  } catch (error) {
    console.error("Trilingual Reader could not show the panel:", error);
  }
});
