#!/usr/bin/env node

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

function replaceAll(str, charToReplace, replacementChar) {
    const regex = new RegExp(charToReplace, 'g'); // 'g' flag for global replacement
    return str.replace(regex, replacementChar);
}

function loadOptions() {
    rulesContainer.innerHTML = ""; // reset container 
    browser.storage.sync.get({
        rules: [] // Default to an empty array if no rules are stored
    }).then(result => {
        result.rules.forEach((rule, index) => {
            const ruleElement = createRuleElement(rule, index);
            rulesContainer.appendChild(ruleElement);
        });
    });
}

function addRule() {
    const newRuleElement = createRuleElement();
    rulesContainer.appendChild(newRuleElement);
    reindexRules(); // Update indices after adding
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
    return ruleNode;
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

function alert(id) {
    document.querySelector("#" + id).style.display = "block";
    setTimeout(() => {
        document.querySelector("#" + id).style.display = "none";
    }, 2000);
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

    browser.storage.sync.set({
        rules: rules
    }).then(() => {
        alert("saved-ok");
    });
}

async function importOptions(file) {
    if (!file) return;
    if (!file.files) return;
    if (!file.files[0]) return;
    try {
        const settings = JSON.parse(await file.files[0].text());
        browser.storage.sync.set(settings);
        alert("imported-ok");
        loadOptions();
    } catch (error) {
        alert("imported-error", error);
    }
}

function exportOptions() {
    browser.storage.sync.get({
        rules: []
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
                alert("exported-ok", exportFileName);
            } catch (error) {
                alert("exported-error", error);
            }
        }
    );
}
