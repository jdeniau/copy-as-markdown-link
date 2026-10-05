#!/bin/bash
# Build the Chrome version of an extension from its Firefox sources,
# overlaid with the Chrome-specific files of chrome/<extension>/.
# Usage: scripts/build-chrome.sh <extension> [version]
# Output: build/chrome/<extension>/ (load it unpacked in chrome://extensions) and build/<extension>-chrome-<version>.zip
set -euo pipefail

EXTENSION_SHORT="${1:?Missing extension argument, e.g. caml}"
GIT_ROOT_PATH="$(git rev-parse --show-toplevel)"
SOURCE_PATH="${GIT_ROOT_PATH}/${EXTENSION_SHORT}"
BUILD_PATH="${GIT_ROOT_PATH}/build/chrome/${EXTENSION_SHORT}"
EXTENSION_VERSION="${2:-$(jq -r '.version' "${SOURCE_PATH}/manifest.json")}"

rm -rf "$BUILD_PATH"
mkdir -p "$BUILD_PATH"
cp -r "$SOURCE_PATH"/. "$BUILD_PATH"
if [ -d "${GIT_ROOT_PATH}/chrome/${EXTENSION_SHORT}" ]; then
    cp -r "${GIT_ROOT_PATH}/chrome/${EXTENSION_SHORT}"/. "$BUILD_PATH"
fi
rm -rf "${BUILD_PATH}/screenshots" "${BUILD_PATH}/README.md" "${BUILD_PATH}"/icons/*.kra "${BUILD_PATH}/icons/src"

# Chrome differences:
# - no gecko settings
# - background runs in a service worker (service-worker.js loads the shared background script)
# - clipboard and matchMedia are only available through an offscreen document
# - Ctrl+Alt shortcuts are forbidden (AltGr conflict), use Alt+Shift instead
jq --arg version "$EXTENSION_VERSION" '
    del(.browser_specific_settings)
    | .version = $version
    | if .background.scripts then .background = { service_worker: "service-worker.js" } else . end
    | if .background.service_worker then .permissions += ["offscreen"] else . end
    | if .commands then .commands |= with_entries(
        if .value.suggested_key then .value.suggested_key = { default: ("Alt+Shift+" + (.value.suggested_key.default | split("+") | last)) } else . end
      ) else . end
' "${SOURCE_PATH}/manifest.json" >"${BUILD_PATH}/manifest.json"

PACKAGE_PATH="${GIT_ROOT_PATH}/build/${EXTENSION_SHORT}-chrome-${EXTENSION_VERSION}.zip"
rm -f "$PACKAGE_PATH"
(cd "$BUILD_PATH" && zip -qr "$PACKAGE_PATH" .)
echo "Chrome extension built to $BUILD_PATH and packaged to $PACKAGE_PATH"
