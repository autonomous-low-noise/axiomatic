#!/usr/bin/env bash
# Downloads a prebuilt PDFium shared library from bblanchon/pdfium-binaries.
# Usage: ./download-pdfium.sh [linux-x64|linux-arm64|mac-arm64|mac-x64|win-x64]

set -euo pipefail

PLATFORM="${1:-}"
if [ -z "$PLATFORM" ]; then
    case "$(uname -s)-$(uname -m)" in
        Linux-x86_64)  PLATFORM="linux-x64" ;;
        Linux-aarch64) PLATFORM="linux-arm64" ;;
        Darwin-arm64)  PLATFORM="mac-arm64" ;;
        Darwin-x86_64) PLATFORM="mac-x64" ;;
        *)
            echo "Could not detect platform. Pass one of: linux-x64, linux-arm64, mac-arm64, mac-x64, win-x64"
            exit 1
            ;;
    esac
fi

URL="https://github.com/bblanchon/pdfium-binaries/releases/latest/download/pdfium-${PLATFORM}.tgz"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
RESOURCES_DIR="$SCRIPT_DIR/resources"
TMP_DIR="$(mktemp -d)"

echo "Downloading PDFium for $PLATFORM..."
curl -sL "$URL" -o "$TMP_DIR/pdfium.tgz"

echo "Extracting..."
tar xzf "$TMP_DIR/pdfium.tgz" -C "$TMP_DIR"

mkdir -p "$RESOURCES_DIR"

case "$PLATFORM" in
    linux-*)
        cp "$TMP_DIR/lib/libpdfium.so" "$RESOURCES_DIR/"
        echo "Installed: $RESOURCES_DIR/libpdfium.so"
        ;;
    mac-*)
        cp "$TMP_DIR/lib/libpdfium.dylib" "$RESOURCES_DIR/"
        echo "Installed: $RESOURCES_DIR/libpdfium.dylib"
        ;;
    win-*)
        cp "$TMP_DIR/bin/pdfium.dll" "$RESOURCES_DIR/"
        echo "Installed: $RESOURCES_DIR/pdfium.dll"
        ;;
esac

rm -rf "$TMP_DIR"
echo "Done."
