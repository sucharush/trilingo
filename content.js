// This file can be injected repeatedly; register the listener only once per page.
if (!globalThis.trilingualReaderLoaded) {
  globalThis.trilingualReaderLoaded = true;

  let currentRequestId;
  let panel;
  let original;
  let originalLabel;
  let english;
  let chinese;
  const notices = {};
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

    const originalSection = document.createElement("section");
    originalLabel = document.createElement("h3");
    originalLabel.textContent = "ORIGINAL";
    original = document.createElement("p");
    original.dir = "auto";
    originalSection.append(originalLabel, original);

    const englishSection = document.createElement("section");
    const englishLabel = document.createElement("h3");
    englishLabel.textContent = "ENGLISH";
    english = document.createElement("p");
    english.lang = "en";
    english.setAttribute("aria-live", "polite");
    english.setAttribute("aria-atomic", "true");
    englishSection.append(englishLabel, english);

    const chineseSection = document.createElement("section");
    const chineseLabel = document.createElement("h3");
    chineseLabel.textContent = "中文";
    chineseLabel.lang = "zh";
    chinese = document.createElement("p");
    chinese.setAttribute("aria-live", "polite");
    chinese.setAttribute("aria-atomic", "true");
    chineseSection.append(chineseLabel, chinese);

    for (const [stage, section] of [["english", englishSection], ["chinese", chineseSection]]) {
      const notice = document.createElement("p");
      notice.className = "trilingual-reader-notice";
      notice.hidden = true;
      notice.setAttribute("aria-live", "polite");
      notices[stage] = notice;
      section.append(notice);
    }

    header.append(title, close);
    panel.append(header, originalSection, englishSection, chineseSection);
    document.body.append(panel);
    // These listeners exist only while a panel is open.
    document.addEventListener("click", onOutsideClick, true);
    document.addEventListener("keydown", onKeyDown);
    panel.focus({ preventScroll: true });
  }

  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === "translation-update") {
      // Ignore older requests and panels that the user has already closed.
      if (message.requestId === currentRequestId && panel?.isConnected) {
        const output = message.stage === "english" ? english : message.stage === "chinese" ? chinese : null;
        if (!output) return;
        output.textContent = message.text;
        output.dataset.state = message.state;
        output.lang = message.stage === "chinese" && message.state === "ready" ? "zh" : "en";
        const notice = notices[message.stage];
        notice.textContent = message.notice || "";
        notice.hidden = !message.notice;
        if (message.sourceLanguage) {
          original.lang = message.sourceLanguage;
          let name = message.sourceLanguage;
          try {
            name = new Intl.DisplayNames(["en"], { type: "language" }).of(message.sourceLanguage);
          } catch {
            // Keep the language code if the browser cannot name it.
          }
          originalLabel.textContent = `ORIGINAL (${name})`;
        }
      }
      return;
    }
    if (message.type !== "show-selection") return;
    currentRequestId = message.requestId;
    if (!panel?.isConnected) createPanel();

    // Treat selected text as text, even if it contains HTML characters.
    original.textContent = message.text;
    original.lang = "und";
    originalLabel.textContent = "ORIGINAL";
    for (const notice of Object.values(notices)) {
      notice.textContent = "";
      notice.hidden = true;
    }
    english.dataset.state = "loading";
    english.textContent = "Detecting language...";
    chinese.lang = "en";
    chinese.dataset.state = "pending";
    chinese.textContent = "Waiting for English...";
  });
}
