#!/usr/bin/env node

// Chrome only exposes the `chrome` namespace (promise based in MV3)
globalThis.browser ??= globalThis.chrome;

const extensionName = browser.runtime.getManifest().name;
const exportFileName = "export-" + replaceAll(extensionName, " ", "-").toLowerCase() + ".json";

document.addEventListener("DOMContentLoaded", loadOptions);
document.querySelector("#add-rule").addEventListener("click", addRule);
document.querySelector("#save-options").addEventListener("click", saveOptions);
document.querySelector("#import-options").addEventListener("click", () => document.querySelector("#import-options-browse").click());
document.querySelector("#import-options-browse").addEventListener("change", () => importOptions(document.querySelector("#import-options-browse")));
document.querySelector("#export-options").addEventListener("click", exportOptions);

const rulesContainer = document.querySelector("#rules-container");
const ruleTemplate = document.querySelector("#rule-template");
const contextMenuCheckboxes = document.querySelectorAll("#context-menus input[data-menu-id]");
const defaultActionSelect = document.querySelector("#default-action");
const statusElement = document.querySelector("#status");
let statusTimeout = null;

defaultActionSelect.addEventListener("change", updateActionCheckboxes);
document.querySelector("#app").addEventListener("input", () => showStatus("Unsaved changes", "", false));

function replaceAll(str, charToReplace, replacementChar) {
    const regex = new RegExp(charToReplace, 'g'); // 'g' flag for global replacement
    return str.replace(regex, replacementChar);
}

function loadOptions() {
    rulesContainer.innerHTML = ""; // reset container 
    browser.storage.sync.get({
        rules: [], // Default to an empty array if no rules are stored
        contextMenus: {}, // Menus are enabled unless explicitly disabled
        defaultAction: "markdown"
    }).then(result => {
        result.rules.forEach((rule, index) => {
            const ruleElement = createRuleElement(rule, index);
            rulesContainer.appendChild(ruleElement);
        });
        contextMenuCheckboxes.forEach(checkbox => {
            checkbox.checked = result.contextMenus[checkbox.dataset.menuId] !== false;
        });
        defaultActionSelect.value = result.defaultAction;
        updateActionCheckboxes();
    });
}

// The default action is never displayed in the extension icon context menu
function updateActionCheckboxes() {
    contextMenuCheckboxes.forEach(checkbox => {
        checkbox.disabled = checkbox.dataset.action === defaultActionSelect.value;
    });
}

function addRule() {
    const newRuleElement = createRuleElement();
    rulesContainer.appendChild(newRuleElement);
    reindexRules(); // Update indices after adding
    newRuleElement.querySelector(".url").focus();
    showStatus("Unsaved changes", "", false);
}

function createRuleElement(ruleData = { pattern: "{{title}}", url: "", search: "", replace: "", prefix: "" }) {
    const ruleNode = ruleTemplate.content.cloneNode(true);
    const ruleDiv = ruleNode.querySelector(".rule-row");
    ruleNode.querySelector(".pattern").value = ruleData.pattern;
    ruleNode.querySelector(".url").value = ruleData.url;
    ruleNode.querySelector(".search").value = ruleData.search;
    ruleNode.querySelector(".replace").value = ruleData.replace;
    ruleNode.querySelector(".prefix").value = ruleData.prefix || "";
    ruleNode.querySelector(".remove-rule-button").addEventListener("click", () => removeRule(ruleDiv));
    // Only the row: the template whitespace would prevent `#rules-container:empty` from showing the empty state
    return ruleDiv;
}

function removeRule(ruleDiv) {
    ruleDiv.remove();
    reindexRules();
    saveOptions();
}

function reindexRules() {
    const ruleDivs = document.querySelectorAll(".rule-row");
    ruleDivs.forEach((ruleDiv, index) => {
        ruleDiv.dataset.index = index;
    });
}

// type: "ok", "error" or "" (neutral). Temporary messages are cleared after a few seconds.
function showStatus(message, type = "ok", temporary = true) {
    clearTimeout(statusTimeout);
    statusElement.textContent = message;
    statusElement.className = type;
    if (temporary) {
        statusTimeout = setTimeout(() => {
            statusElement.textContent = "";
            statusElement.className = "";
        }, 3000);
    }
}

function saveOptions() {
    const rules = [];
    const ruleDivs = document.querySelectorAll(".rule-row");

    ruleDivs.forEach(ruleDiv => {
        const pattern = ruleDiv.querySelector(".pattern").value;
        const url = ruleDiv.querySelector(".url").value;
        const search = ruleDiv.querySelector(".search").value;
        const replace = ruleDiv.querySelector(".replace").value;
        const prefix = ruleDiv.querySelector(".prefix").value;

        rules.push({ pattern: pattern, url: url, search: search, replace: replace, prefix: prefix });
    });

    const contextMenus = {};
    contextMenuCheckboxes.forEach(checkbox => {
        contextMenus[checkbox.dataset.menuId] = checkbox.checked;
    });

    browser.storage.sync.set({
        rules: rules,
        contextMenus: contextMenus,
        defaultAction: defaultActionSelect.value
    }).then(() => {
        showStatus("Options saved");
    }).catch(error => {
        showStatus(`Options not saved: ${error.message}`, "error");
    });
}

async function importOptions(file) {
    if (!file) return;
    if (!file.files) return;
    if (!file.files[0]) return;
    try {
        const settings = JSON.parse(await file.files[0].text());
        await browser.storage.sync.set(settings);
        loadOptions();
        showStatus("Options imported from file");
    } catch (error) {
        showStatus(`Import failed: ${error.message}`, "error");
    } finally {
        file.value = ""; // allows importing the same file again
    }
}

function exportOptions() {
    browser.storage.sync.get({
        rules: [],
        contextMenus: {},
        defaultAction: "markdown"
    }).then(
        results => {
            try {
                const jsonString = JSON.stringify(results, null, 2);
                const blob = new Blob([jsonString], { type: "application/json" });
                const link = document.createElement("a");
                link.href = URL.createObjectURL(blob);
                link.download = exportFileName;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                showStatus(`Options exported to ${exportFileName}`);
            } catch (error) {
                showStatus(`Export failed: ${error.message}`, "error");
            }
        }
    );
}
