#!/usr/bin/env node

// Chrome only exposes the `chrome` namespace (promise based in MV3)
globalThis.browser ??= globalThis.chrome;

let isDarkThemeStatus = false;
let textSelection = null;
const darknessThreshold = 128;

// Generated from icons/src/*.svg by scripts/build-icons.sh
const toolbarIcon = name => ({ 16: `icons/${name}-16.png`, 32: `icons/${name}-32.png` });

const ICONS = {
    dark: {
        active: toolbarIcon("toolbar-dark-copied"),
        inactive: toolbarIcon("toolbar-dark")
    },
    light: {
        active: toolbarIcon("toolbar-light-copied"),
        inactive: toolbarIcon("toolbar-light")
    }
}

const LINK_CONTEXT_MENUS = {
    "copy-link-markdown-context-menu": { type: "markdown", title: "Markdown Link" },
    "copy-link-jira-context-menu": { type: "jira", title: "Jira Link" },
    "copy-link-html-context-menu": { type: "html", title: "HTML Link" },
    "copy-link-rich-text-context-menu": { type: "rich", title: "Rich Text Link" }
};

const ACTION_CONTEXT_MENUS = {
    "copy-markdown-link-context-menu": { type: "markdown", title: "Copy as Markdown Link" },
    "copy-jira-link-context-menu": { type: "jira", title: "Copy as Jira Link" },
    "copy-html-link-context-menu": { type: "html", title: "Copy as HTML Link" },
    "copy-rich-text-link-context-menu": { type: "rich", title: "Copy as Rich Text Link" }
};

// Type of link copied when clicking the extension icon (`defaultAction` storage key)
const DEFAULT_ACTION = "markdown";

async function getDefaultAction() {
    const { defaultAction = DEFAULT_ACTION } = await browser.storage.sync.get("defaultAction");
    return defaultAction;
}

async function updateActionTitle() {
    const defaultAction = await getDefaultAction();
    const menu = Object.values(ACTION_CONTEXT_MENUS).find(menu => menu.type === defaultAction);
    browser.action.setTitle({ title: menu?.title ?? "Copy Link As" });
}

// Menus are enabled unless explicitly disabled in the options (`contextMenus` storage key)
async function createContextMenus() {
    // The background is not persistent: remove menus before re-creating them to avoid duplicate ids
    await browser.contextMenus.removeAll();
    const { contextMenus = {} } = await browser.storage.sync.get("contextMenus");
    const isEnabled = id => contextMenus[id] !== false;
    const defaultAction = await getDefaultAction();

    for (const [id, menu] of Object.entries(ACTION_CONTEXT_MENUS)) {
        // The default action is already triggered by clicking the icon
        if (menu.type === defaultAction || !isEnabled(id)) continue;
        browser.contextMenus.create({
            id: id,
            title: menu.title,
            contexts: ["action"]
        });
    }

    const linkMenus = Object.entries(LINK_CONTEXT_MENUS).filter(([id]) => isEnabled(id));
    if (linkMenus.length === 0) {
        return;
    }
    browser.contextMenus.create({
        id: "copy-link-context-menu",
        title: "Copy Link As",
        contexts: ["link"]
    });
    for (const [id, menu] of linkMenus) {
        browser.contextMenus.create({
            id: id,
            parentId: "copy-link-context-menu",
            title: menu.title,
            contexts: ["link"]
        });
    }
}

// Queue rebuilds so that concurrent calls do not create duplicate ids
let contextMenusUpdate = createContextMenus();
updateActionTitle();

browser.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "sync") {
        return;
    }
    if (changes.contextMenus || changes.defaultAction) {
        contextMenusUpdate = contextMenusUpdate.catch(() => {}).then(createContextMenus);
    }
    if (changes.defaultAction) {
        updateActionTitle();
    }
});

let colorContext = null;

// Theme colors are any CSS color ("#000", "white", "rgb(...)"...) or an [r, g, b] array.
// Returns { luminance (0-255), opaque }, or null when the color is missing or invalid.
function parseThemeColor(color) {
    if (Array.isArray(color)) {
        color = `rgb(${color.join(",")})`;
    }
    if (typeof color !== "string") {
        return null;
    }
    // Painting a pixel lets the browser parse every CSS color syntax
    colorContext ??= new OffscreenCanvas(1, 1).getContext("2d", { willReadFrequently: true });
    colorContext.clearRect(0, 0, 1, 1);
    colorContext.fillStyle = "transparent";
    colorContext.fillStyle = color;
    colorContext.fillRect(0, 0, 1, 1);
    const [r, g, b, alpha] = colorContext.getImageData(0, 0, 1, 1).data;
    return alpha === 0 ? null : { luminance: 0.299 * r + 0.587 * g + 0.114 * b, opaque: alpha === 255 };
}

const prefersDark = () => window.matchMedia("(prefers-color-scheme: dark)").matches;

// Same order as Firefox to pick the toolbar color scheme (LightweightThemeConsumer.sys.mjs).
function isDarkThemeDetails(details) {
    // theme.getCurrent() always returns the manifest `theme`, never the `dark_theme` variant applied
    // when the OS is dark (bug 1435216). Both variants usually declare a color_scheme, which Firefox
    // forwards to prefers-color-scheme for the applied variant.
    const colorScheme = details?.properties?.color_scheme;
    if (colorScheme === "light" || colorScheme === "dark") {
        return prefersDark();
    }
    const colors = details?.colors;
    const toolbar = parseThemeColor(colors?.toolbar);
    if (toolbar?.opaque) {
        return toolbar.luminance < darknessThreshold;
    }
    const toolbarText = parseThemeColor(colors?.toolbar_text ?? colors?.tab_background_text);
    if (toolbarText) {
        return toolbarText.luminance >= darknessThreshold;
    }
    const frame = parseThemeColor(colors?.frame);
    if (frame) {
        return frame.luminance < darknessThreshold;
    }
    // Default theme, or theme without colors: the toolbar follows the OS color scheme
    return prefersDark();
}

async function isDarkTheme() {
    try {
        // Wait for a short delay to allow theme to initialize
        await new Promise(resolve => setTimeout(resolve, 50));
        isDarkThemeStatus = isDarkThemeDetails(await browser.theme.getCurrent());
    } catch (error) {
        console.warn("Error getting theme information:", error);
        isDarkThemeStatus = prefersDark();
    }
    setIcon();
}

function setIcon(active = "inactive") {
    browser.action.setIcon({ path: ICONS[isDarkThemeStatus ? "dark" : "light"][active] });
}

async function getSelectedTextAsync() {
    try {
        let [tab] = await browser.tabs.query({
            active: true,
            currentWindow: true
        });
        if (!tab) {
            return null;
        }
        let result = await browser.scripting.executeScript({
            target: {
                tabId: tab.id
            },
            files: ["content.js"]
        });
        if (result && result[0] && result[0].result) {
            return result[0].result;
        } else {
            return null;
        }
    } catch (error) {
        console.error("Error getting selected text:", error);
        return null;
    }
}

function replacePatterns(text, data) {
    text = text.replace(/{{title}}/g, `${data.title}`);
    text = text.replace(/{{url}}/g, `${data.url}`);
    return text.replace(/{{selection}}/g, data?.selection !== null ? `${data.selection}` : "");
}

function replaceDelimiter(text, delimiterStart, delimiterStop, newDelimiter = "-") {
    if (!delimiterStart) {
        return text
    }
    if (delimiterStop) {
        text = text.replace(new RegExp(` ${delimiterStart}`, 'g'), ` ${newDelimiter} `);
        text = text.replace(new RegExp(`${delimiterStop} `, 'g'), ` ${newDelimiter} `);
        text = text.replace(new RegExp(delimiterStop, 'g'), "");
    }
    return text.replace(new RegExp(delimiterStart, 'g'), "");
}

function sanitizeForTypeLink(text, typeOfLink = "markdown") {
    if (typeOfLink === "html") {
        text = replaceDelimiter(text, "\\>");
        return replaceDelimiter(text, "\\<");
    }
    text = replaceDelimiter(text, "\\[", "\\]");
    if (typeOfLink === "jira") {
        return replaceDelimiter(text, "\\|");
    }
    // else markdown
    return text;
}

function escapeHtml(text) {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function withPrefix(link, prefix) {
    return prefix ? `${prefix} ${link}` : link;
}

function writeToClipboard(text, html = null) {
    if (!html) {
        return navigator.clipboard.writeText(text);
    }
    return navigator.clipboard.write([
        new ClipboardItem({
            "text/html": new Blob([html], { type: "text/html" }),
            "text/plain": new Blob([text], { type: "text/plain" })
        })
    ]);
}

// Injected in the page, so it must be self-contained.
// Inline styles and the Web Animations API are not blocked by the page CSP, unlike a <style> element.
function showToast(message) {
    const id = "copy-link-as-toast";
    document.getElementById(id)?.remove();
    const host = document.createElement("div");
    host.id = id;
    host.style.cssText = "all: initial; position: fixed; top: 16px; left: 50%; transform: translateX(-50%); z-index: 2147483647; pointer-events: none;";
    const toast = document.createElement("div");
    toast.setAttribute("role", "status");
    toast.textContent = message;
    toast.style.cssText = "font: 500 14px/1.4 system-ui, sans-serif; padding: 10px 16px; border-radius: 8px; border: 1px solid rgb(255 255 255 / 0.15); background: #2b2b2b; color: #fff; box-shadow: 0 4px 16px rgb(0 0 0 / 0.3);";
    // Shadow DOM: the page stylesheets do not apply to the toast
    host.attachShadow({ mode: "closed" }).append(toast);
    document.documentElement.append(host);
    toast.animate([{ opacity: 0, transform: "translateY(-8px)" }, { opacity: 1, transform: "none" }], { duration: 150, easing: "ease-out" });
    setTimeout(() => {
        toast.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300, fill: "forwards" }).finished.then(() => host.remove());
    }, 2000);
}

function notifyTab(tabId, message) {
    browser.scripting.executeScript({ target: { tabId: tabId }, func: showToast, args: [message] }).catch(error => {
        // Browser pages (about:, chrome://, add-ons stores...) cannot be scripted: the toolbar icon remains the only feedback
        console.warn("Cannot show the toast:", error);
    });
}

function copyLink(typeOfLink, data, url, tabId) {
    const linkTitle = Object.values(LINK_CONTEXT_MENUS).find(menu => menu.type === typeOfLink).title;
    browser.storage.sync.get("rules").then(result => {
        const rules = result.rules || [];
        let title = data.title;
        let prefix = "";
        for (const rule of rules) {

            const regexUrl = new RegExp(rule.url);
            if (!regexUrl.test(url.toString())) continue;

            title = replacePatterns(rule.pattern, data);

            const regexSearch = new RegExp(rule.search);
            if (!regexSearch.test(title)) continue;

            title = title.replace(regexSearch, rule.replace);
            prefix = replacePatterns(rule.prefix || "", data);
            break;
        }

        const rawTitle = replacePatterns(title, data);
        title = sanitizeForTypeLink(rawTitle, typeOfLink);
        let formattedLink = `[${title}](${url.toString()})`;
        let richLink = null;
        if (typeOfLink === "jira") {
            formattedLink = `[${title}|${url.toString()}]`;
        } else if (typeOfLink === "html") {
            formattedLink = `<a href="${url.toString()}" title="${title}" target="_new">${title}</a>`;
        } else if (typeOfLink === "rich") {
            richLink = withPrefix(`<a href="${escapeHtml(url.toString())}">${escapeHtml(rawTitle)}</a>`, escapeHtml(prefix));
        }
        formattedLink = withPrefix(formattedLink, prefix);
        writeToClipboard(formattedLink, richLink).then(() => {
            console.log("Copied to clipboard:", richLink || formattedLink);
            setIcon("active");
            setTimeout(() => {
                setIcon();
            }, 2000);
            notifyTab(tabId, `✓ ${linkTitle} copied`);
        }).catch(err => {
            console.error("Failed to copy:", err);
            notifyTab(tabId, `✗ Failed to copy the ${linkTitle}`);
        });
    });
}

function createLink(typeOfLink = "markdown") {
    browser.tabs.query({ active: true, currentWindow: true }).then(tabs => {
        const tab = tabs[0];
        if (!tab) {
            console.error("No active tab found!");
            return;
        }
        getSelectedTextAsync().then(result => {
            const url = new URL(tab.url);
            const data = {
                title: tab.title,
                url: url.toString(),
                selection: result,
            };
            if (result) {
                url.hash = `:~:text=${encodeURIComponent(result)}`;
            }
            copyLink(typeOfLink, data, url, tab.id);
        });
    });
}

// Chrome does not provide the link text in the context menu info: read it from the page
async function getLinkTextAsync(info, tab) {
    if (info.linkText !== undefined) {
        return info.linkText;
    }
    try {
        const result = await browser.scripting.executeScript({
            target: {
                tabId: tab.id,
                frameIds: [info.frameId || 0]
            },
            func: linkUrl => {
                const link = Array.from(document.querySelectorAll("a[href]")).find(a => a.href === linkUrl);
                return link ? link.innerText : null;
            },
            args: [info.linkUrl]
        });
        return result?.[0]?.result || null;
    } catch (error) {
        console.error("Error getting link text:", error);
        return null;
    }
}

async function createLinkFromAnchor(typeOfLink, info, tab) {
    const url = new URL(info.linkUrl);
    const text = (await getLinkTextAsync(info, tab) || "").trim();
    const data = {
        title: text || url.toString(),
        url: url.toString(),
        selection: null,
    };
    copyLink(typeOfLink, data, url, tab.id);
}

browser.commands.onCommand.addListener(function (command) {
    if (command === "copy-markdown-link") {
        createLink();
    }
});

browser.commands.onCommand.addListener(function (command) {
    if (command === "copy-jira-link") {
        createLink("jira");
    }
});

browser.commands.onCommand.addListener(function (command) {
    if (command === "copy-html-link") {
        createLink("html");
    }
});

browser.commands.onCommand.addListener(function (command) {
    if (command === "copy-rich-text-link") {
        createLink("rich");
    }
});

browser.contextMenus.onClicked.addListener(function (info) {
    const menu = ACTION_CONTEXT_MENUS[info.menuItemId];
    if (menu) {
        createLink(menu.type);
    }
});

browser.contextMenus.onClicked.addListener(function (info, tab) {
    const menu = LINK_CONTEXT_MENUS[info.menuItemId];
    if (menu) {
        createLinkFromAnchor(menu.type, info, tab);
    }
});

browser.action.onClicked.addListener(async function () {
    createLink(await getDefaultAction());
});

// Chrome has no theme API nor matchMedia in its service worker, see chrome/caml/service-worker.js
if (browser.theme) {
    browser.theme.onUpdated.addListener(isDarkTheme);

    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", isDarkTheme);

    (async () => {
        await isDarkTheme();
    })();
}
