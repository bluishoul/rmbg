#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BINARIES_DIR="$(dirname "$SCRIPT_DIR")/binaries"

echo "Building rmbg-sidecar (universal binary)..."
cd "$SCRIPT_DIR"

# Build universal binary for macOS (arm64 + x86_64)
swift build -c release --arch arm64 --arch x86_64

# Find the built binary
BUILT_BINARY="$SCRIPT_DIR/.build/apple/Products/Release/rmbg-sidecar"

if [ ! -f "$BUILT_BINARY" ]; then
    echo "Error: Built binary not found at $BUILT_BINARY"
    echo "Trying alternative path..."
    BUILT_BINARY=$(find "$SCRIPT_DIR/.build" -name "rmbg-sidecar" -type f -perm +111 | head -1)
    if [ -z "$BUILT_BINARY" ]; then
        echo "Error: Could not find built binary"
        exit 1
    fi
fi

echo "Built binary: $BUILT_BINARY"

# Create binaries directory
mkdir -p "$BINARIES_DIR"

# Copy universal binary for both architectures
# Tauri expects binaries named with target triple suffix
cp "$BUILT_BINARY" "$BINARIES_DIR/rmbg-sidecar-aarch64-apple-darwin"
cp "$BUILT_BINARY" "$BINARIES_DIR/rmbg-sidecar-x86_64-apple-darwin"
# Also copy for universal target
cp "$BUILT_BINARY" "$BINARIES_DIR/rmbg-sidecar-universal-apple-darwin"

echo "Sidecar binaries copied to $BINARIES_DIR"
ls -la "$BINARIES_DIR"/rmbg-sidecar-*
