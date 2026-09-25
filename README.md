# Extensions for Firefox

[![Workflow Status](https://github.com/jdeniau/copy-as-markdown-link/actions/workflows/publish-to-mozilla.yml/badge.svg)](https://github.com/jdeniau/copy-as-markdown-link/actions)

This repo contains some Firefox extensions & themes:

|Type|Name|Description|
|:---:|:---:|:---:|
|Theme|[Custom Accentuation Color Dark High Contrast](./cacdh/)|Dark High Contrast Theme with customizable accentuation color.|
|Extension|[Copy Link As](./caml/)|Copies the current tab's URL and title as a Markdown/Jira/HTML/rich text link to the clipboard.|

## Development

Open the "Manage extensions" Firefox page: `about:addons`.

Go to the "Extensions" section and click the gear icon. Then choose "Debug Add-ons".

On the newly opened page, click "Load Temporary Add-ons..."

A popup window opens, for example for the [Copy Link As](./caml/) Extension, browse the local repository to the [manifest](./caml/manifest.json) file.

The extension should appears in the "Temporary Extensions" section.

Near the extension, click "Inspect".

Make the changes locally.

On the web developer tools, click the reload icon on the top to reload the extension and see your changes.
