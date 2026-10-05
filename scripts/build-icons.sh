#!/bin/bash
# Render the PNG icons of an extension from its SVG sources (icons/src/*.svg).
# Browsers do not all accept SVG icons (Chrome does not), so the PNGs are committed.
# Usage: scripts/build-icons.sh [extension]
# Requires ImageMagick built with librsvg.
set -euo pipefail

EXTENSION_SHORT="${1:-caml}"
GIT_ROOT_PATH="$(git rev-parse --show-toplevel)"
ICONS_PATH="${GIT_ROOT_PATH}/${EXTENSION_SHORT}/icons"

# render <source svg> <size> <output png>
render() {
    local source="${ICONS_PATH}/src/$1" size="$2" output="${ICONS_PATH}/$3"
    local width
    width="$(sed -nE 's/.*<svg[^>]* width="([0-9.]+)".*/\1/p' "$source")"
    # Rasterize at the target size (not a resize of a bigger render) to keep strokes sharp
    magick -background none -density "$(echo "72 * $size / $width" | bc -l)" "RSVG:${source}" \
        -resize "${size}x${size}" -gravity center -extent "${size}x${size}" "PNG32:${output}"
    echo "$3"
}

# Extension and store icon
for size in 16 32 48 128; do
    render store.svg "$size" "icon-${size}.png"
done
render store.svg 512 icon.png

# Toolbar icons, see ICONS in background.js
for variant in light dark light-copied dark-copied; do
    for size in 16 32; do
        render "toolbar-${variant}.svg" "$size" "toolbar-${variant}-${size}.png"
    done
done
