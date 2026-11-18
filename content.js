// This file can be injected repeatedly; register the listener only once per page.
if (!globalThis.trilingualReaderLoaded) {
  globalThis.trilingualReaderLoaded = true;

  let currentRequestId;
  let translation;

  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === "translation-result") {
      // Ignore older requests and panels that the user has already closed.
      if (message.requestId === currentRequestId && translation?.isConnected) {
        translation.textContent = message.error || message.text;
      }
      return;
    }
    if (message.type !== "show-selection") return;
    currentRequestId = message.requestId;

    // Replace the previous panel so repeated clicks never stack panels.
    document.getElementById("trilingual-reader-panel")?.remove();

    const panel = document.createElement("section");
    panel.id = "trilingual-reader-panel";
    panel.setAttribute("aria-label", "Trilingual Reader");

    const header = document.createElement("header");
    const title = document.createElement("strong");
    title.textContent = "Trilingual Reader";

    const close = document.createElement("button");
    close.type = "button";
    close.textContent = "×";
    close.setAttribute("aria-label", "Close Trilingual Reader");
    close.addEventListener("click", () => panel.remove());

    const text = document.createElement("p");
    // Treat selected text as text, even if it contains HTML characters.
    text.textContent = message.text;
    text.lang = "en";

    translation = document.createElement("p");
    translation.lang = "zh";
    translation.setAttribute("aria-live", "polite");
    translation.textContent = "Translating...";

    header.append(title, close);
    panel.append(header, text, translation);
    document.body.append(panel);
  });
}
