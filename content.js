// This file can be injected repeatedly; register the listener only once per page.
if (!globalThis.trilingualReaderLoaded) {
  globalThis.trilingualReaderLoaded = true;

  let currentRequestId;
  let panel;
  let english;
  let translation;
  let previousFocus;

  function closePanel() {
    const restoreFocus = panel?.contains(document.activeElement);
    panel?.remove();
    panel = null;
    currentRequestId = null;
    document.removeEventListener("click", onOutsideClick, true);
    document.removeEventListener("keydown", onKeyDown);
    if (restoreFocus && previousFocus?.isConnected) {
      previousFocus.focus({ preventScroll: true });
    }
  }

  function onOutsideClick(event) {
    if (panel && !event.composedPath().includes(panel)) closePanel();
  }

  function onKeyDown(event) {
    if (event.key === "Escape") closePanel();
  }

  function createPanel() {
    previousFocus = document.activeElement;
    panel = document.createElement("section");
    panel.id = "trilingual-reader-panel";
    panel.tabIndex = -1;
    panel.setAttribute("role", "region");
    panel.setAttribute("aria-labelledby", "trilingual-reader-title");

    const header = document.createElement("header");
    const title = document.createElement("h2");
    title.id = "trilingual-reader-title";
    title.textContent = "Trilingual Reader";

    const close = document.createElement("button");
    close.type = "button";
    close.textContent = "×";
    close.setAttribute("aria-label", "Close Trilingual Reader");
    close.addEventListener("click", closePanel);

    const englishSection = document.createElement("section");
    const englishLabel = document.createElement("h3");
    englishLabel.textContent = "English";
    english = document.createElement("p");
    english.lang = "en";
    englishSection.append(englishLabel, english);

    const chineseSection = document.createElement("section");
    const chineseLabel = document.createElement("h3");
    chineseLabel.textContent = "中文";
    chineseLabel.lang = "zh";
    translation = document.createElement("p");
    translation.setAttribute("aria-live", "polite");
    translation.setAttribute("aria-atomic", "true");
    chineseSection.append(chineseLabel, translation);

    header.append(title, close);
    panel.append(header, englishSection, chineseSection);
    document.body.append(panel);
    // These listeners exist only while a panel is open.
    document.addEventListener("click", onOutsideClick, true);
    document.addEventListener("keydown", onKeyDown);
    panel.focus({ preventScroll: true });
  }

  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === "translation-result") {
      // Ignore older requests and panels that the user has already closed.
      if (message.requestId === currentRequestId && translation?.isConnected) {
        translation.textContent = message.error || message.text;
        translation.dataset.state = message.error ? "error" : "ready";
        translation.lang = message.error ? "en" : "zh";
      }
      return;
    }
    if (message.type !== "show-selection") return;
    currentRequestId = message.requestId;
    if (!panel?.isConnected) createPanel();

    // Treat selected text as text, even if it contains HTML characters.
    english.textContent = message.text;
    translation.lang = "en";
    translation.dataset.state = "loading";
    translation.textContent = "Translating...";
  });
}
