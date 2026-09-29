#!/usr/bin/env node

const darkScheme = window.matchMedia("(prefers-color-scheme: dark)");

function copy(text, html) {
    // navigator.clipboard requires a focused document, which an offscreen document never is
    const textarea = document.querySelector("#clipboard");
    textarea.value = text;
    textarea.select();
    document.addEventListener("copy", event => {
        event.clipboardData.setData("text/plain", text);
        if (html) {
            event.clipboardData.setData("text/html", html);
        }
        event.preventDefault();
    }, { once: true });
    const success = document.execCommand("copy");
    textarea.value = "";
    return success;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.target !== "offscreen") {
        return;
    }
    if (message.type === "copy") {
        sendResponse({ success: copy(message.text, message.html) });
    } else if (message.type === "get-color-scheme") {
        sendResponse({ isDark: darkScheme.matches });
    }
});

darkScheme.addEventListener("change", () => {
    chrome.runtime.sendMessage({ target: "background", type: "color-scheme", isDark: darkScheme.matches });
});
