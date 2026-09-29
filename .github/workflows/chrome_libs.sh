#!/bin/bash
# Requires the variables exported by checkTag (mozilla_libs.sh)

CHROME_WEBSTORE_API="https://chromewebstore.googleapis.com"

function _base64url() {
    openssl base64 -e -A | tr '+/' '-_' | tr -d '='
}

function checkChromeItem() {
    _export CHROME_ITEM_ID="$(jq -r '.item_id // empty' "${GIT_ROOT_PATH}/chrome/${EXTENSION_SHORT}.json" 2>/dev/null)"
    if [ -z "$CHROME_ITEM_ID" ]; then
        echo "Missing item_id in ${GIT_ROOT_PATH}/chrome/${EXTENSION_SHORT}.json"
        exit 2
    fi
    echo "Chrome Web Store item $CHROME_ITEM_ID"
}

function buildChrome() {
    "${GIT_ROOT_PATH}/scripts/build-chrome.sh" "$EXTENSION_SHORT" "$EXTENSION_VERSION"
    _export CHROME_PACKAGE_PATH="${GIT_ROOT_PATH}/build/${EXTENSION_SHORT}-chrome-${EXTENSION_VERSION}.zip"
    if ! [ -f "$CHROME_PACKAGE_PATH" ]; then
        echo "Missing package $CHROME_PACKAGE_PATH despite build finished successfully"
        exit 4
    fi
}

# Exchange a JWT signed with the service account key for an access token
function _getAccessToken() {
    local client_email header claims signature token
    client_email="$(jq -r '.client_email' <<<"$CHROME_WEBSTORE_SERVICE_ACCOUNT_KEY")"
    header="$(printf '{"alg":"RS256","typ":"JWT"}' | _base64url)"
    claims="$(jq -nc --arg iss "$client_email" --argjson iat "$(date +%s)" '{
        iss: $iss,
        scope: "https://www.googleapis.com/auth/chromewebstore",
        aud: "https://oauth2.googleapis.com/token",
        iat: $iat,
        exp: ($iat + 3600)
    }' | _base64url)"
    signature="$(printf '%s.%s' "$header" "$claims" | openssl dgst -sha256 -binary -sign <(jq -r '.private_key' <<<"$CHROME_WEBSTORE_SERVICE_ACCOUNT_KEY") | _base64url)"
    token="$(curl -sS --fail-with-body "https://oauth2.googleapis.com/token" \
        -d "grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer" \
        -d "assertion=${header}.${claims}.${signature}" | jq -r '.access_token // empty')"
    if [ -z "$token" ]; then
        echo "Cannot get an access token for the service account $client_email" >&2
        exit 5
    fi
    echo "$token"
}

function publishChrome() {
    if [ -z "$CHROME_WEBSTORE_SERVICE_ACCOUNT_KEY" ]; then
        echo "Missing service account key. Please declare a GitHub secret named CHROME_WEBSTORE_SERVICE_ACCOUNT_KEY"
        exit 5
    fi
    if [ -z "$CHROME_WEBSTORE_PUBLISHER_ID" ]; then
        echo "Missing publisher id. Please declare a GitHub secret named CHROME_WEBSTORE_PUBLISHER_ID"
        exit 5
    fi
    local token item response upload_state
    token="$(_getAccessToken)"
    echo "::add-mask::$token"
    item="publishers/${CHROME_WEBSTORE_PUBLISHER_ID}/items/${CHROME_ITEM_ID}"

    response="$(curl -sS --fail-with-body -H "Authorization: Bearer $token" -X POST -T "$CHROME_PACKAGE_PATH" "${CHROME_WEBSTORE_API}/upload/v2/${item}:upload")"
    jq . <<<"$response"
    upload_state="$(jq -r '.uploadState' <<<"$response")"
    TTL=15
    INTERVAL=10
    while [ "$upload_state" == "IN_PROGRESS" ] && [ $TTL -gt 0 ]; do
        echo "Waiting ${INTERVAL}s for the upload to be processed ($TTL attempt(s) left)..."
        sleep $INTERVAL
        TTL=$((TTL - 1))
        upload_state="$(curl -sS --fail-with-body -H "Authorization: Bearer $token" "${CHROME_WEBSTORE_API}/v2/${item}:fetchStatus" | jq -r '.lastAsyncUploadState')"
    done
    if [ "$upload_state" != "SUCCEEDED" ]; then
        echo "Upload of $CHROME_PACKAGE_PATH failed with state $upload_state"
        exit 6
    fi
    echo "Package version $EXTENSION_VERSION uploaded successfully to item $CHROME_ITEM_ID"

    response="$(curl -sS --fail-with-body -H "Authorization: Bearer $token" -H "Content-Type: application/json" -X POST \
        -d '{"publishType":"DEFAULT_PUBLISH"}' "${CHROME_WEBSTORE_API}/v2/${item}:publish")"
    jq . <<<"$response"
    echo "Package version $EXTENSION_VERSION submitted for review with state $(jq -r '.state' <<<"$response")"
}
