#!/bin/bash

# Build script for Zenuxs Desktop on Linux

set -e

echo "[ROCKET] Building Zenuxs Desktop for Linux..."

# Check if bun is installed
if ! command -v bun &> /dev/null; then
    echo "[X] Bun is not installed. Please install it from https://bun.sh"
    exit 1
fi

# Check if electron-builder is installed
if ! command -v electron-builder &> /dev/null; then
    echo "[PACKAGE] Installing dependencies..."
    bun install
fi

# Build the application
echo "[TOOL] Building the application..."
bun run build

# Build Linux packages
echo "[PACKAGE] Building Linux packages..."

# Build AppImage
echo "   - Building AppImage..."
bun run package --linux appimage

# Build Debian package
echo "   - Building Debian package..."
bun run package --linux deb

# Build RPM package
echo "   - Building RPM package..."
bun run package --linux rpm

echo "[OK] Build complete!"
echo ""
echo "[PACKAGE] Built packages are located in: ./dist"
echo ""
echo "Available packages:"
ls -lh ./dist/*.AppImage ./dist/*.deb ./dist/*.rpm 2>/dev/null || echo "No packages found"
