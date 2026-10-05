# Extensions for Firefox (and Chrome)

[![Workflow Status](https://github.com/jdeniau/copy-as-markdown-link/actions/workflows/publish-to-mozilla.yml/badge.svg)](https://github.com/jdeniau/copy-as-markdown-link/actions)

This repo contains some Firefox extensions & themes:

|Type|Name|Description|
|:---:|:---:|:---:|
|Theme|[Custom Accentuation Color Dark High Contrast](./cacdh/)|Dark High Contrast Theme with customizable accentuation color.|
|Extension|[Copy Link As](./caml/)|Copies the current tab's URL and title as a Markdown/Jira/HTML/rich text link to the clipboard. Also available on the [Chrome Web Store](https://chromewebstore.google.com/detail/onicfbcjjkagepepfmneheodahkckioj).|

## Development

Open the "Manage extensions" Firefox page: `about:addons`.

Go to the "Extensions" section and click the gear icon. Then choose "Debug Add-ons".

On the newly opened page, click "Load Temporary Add-ons..."

A popup window opens, for example for the [Copy Link As](./caml/) Extension, browse the local repository to the [manifest](./caml/manifest.json) file.

The extension should appears in the "Temporary Extensions" section.

Near the extension, click "Inspect".

Make the changes locally.

On the web developer tools, click the reload icon on the top to reload the extension and see your changes.

### Chrome

The sources are shared with Firefox, the Chrome-specific files live in [chrome/](./chrome/) (e.g. the service worker entry point and the offscreen document used to write to the clipboard).

Build the Chrome version:

```sh
scripts/build-chrome.sh caml [version]
```

It generates `build/chrome/caml/` and `build/caml-chrome-<version>.zip` (to upload on the Chrome Web Store).

Open `chrome://extensions`, enable the "Developer mode", click "Load unpacked" and select the `build/chrome/caml/` folder.

After a change, run the build script again and click the reload icon of the extension.

## Publishing

Pushing a signed tag like `caml_v1.2.3` publishes the version `1.2.3` to the Firefox Add-ons (`publish-to-mozilla.yml`) and to the Chrome Web Store (`publish-to-chrome.yml`, for the extensions having a `chrome/<extension>.json` file).

The Chrome Web Store API cannot create an item, so the first time:

1. Upload the zip built by `scripts/build-chrome.sh` in the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole) and fill the "Store listing" and "Privacy" tabs.
2. Put the item id in `chrome/<extension>.json`.
3. In the [Google Cloud Console](https://console.cloud.google.com/), enable the "Chrome Web Store API", create a service account (no role needed) and a JSON key for it.
4. In the Developer Dashboard "Account" section, add the service account email.
5. Declare the GitHub secrets `CHROME_WEBSTORE_SERVICE_ACCOUNT_KEY` (the JSON key content) and `CHROME_WEBSTORE_PUBLISHER_ID` (in the Developer Dashboard "Publisher > Settings").
