#!/usr/bin/env node

// Chrome entry point. background.js is shared with Firefox, but a Chrome service worker
// has no access to the clipboard, the theme API nor matchMedia: an offscreen document does it.
importScripts("background.js");

let creatingOffscreenDocument = null;

async function setupOffscreenDocument() {
    if (await chrome.offscreen.hasDocument()) {
        return;
    }
    creatingOffscreenDocument ??= chrome.offscreen.createDocument({
        url: "offscreen.html",
        reasons: ["CLIPBOARD", "MATCH_MEDIA"],
        justification: "Write links to the clipboard and detect the color scheme for the toolbar icon"
    }).finally(() => {
        creatingOffscreenDocument = null;
    });
    await creatingOffscreenDocument;
}

// Replaces the Firefox implementation declared in background.js
// (an assignment, as a function declaration would be hoisted before importScripts and overridden)
writeToClipboard = async function (text, html = null) {
    await setupOffscreenDocument();
    const response = await chrome.runtime.sendMessage({ target: "offscreen", type: "copy", text: text, html: html });
    if (!response?.success) {
        throw new Error("Offscreen document failed to write to the clipboard");
    }
};

async function updateColorScheme() {
    await setupOffscreenDocument();
    const response = await chrome.runtime.sendMessage({ target: "offscreen", type: "get-color-scheme" });
    isDarkThemeStatus = response?.isDark ?? false;
    setIcon();
}

chrome.runtime.onMessage.addListener(message => {
    if (message.target === "background" && message.type === "color-scheme") {
        isDarkThemeStatus = message.isDark;
        setIcon();
    }
});

updateColorScheme();
