// This file can be injected repeatedly; register the listener only once per page.
if (!globalThis.trilingualReaderLoaded) {
  globalThis.trilingualReaderLoaded = true;

  chrome.runtime.onMessage.addListener((message) => {
    if (message.type !== "show-selection") return;

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

    header.append(title, close);
    panel.append(header, text);
    document.body.append(panel);
  });
}
