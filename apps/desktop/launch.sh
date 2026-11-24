#!/bin/bash

# Launch script for Zenuxs Desktop
# This script launches the application with proper Electron configuration

cd "$(dirname "$0")"

# Check if Electron is installed
if [ ! -d "node_modules/electron" ]; then
    echo "Installing Electron..."
    bun install
fi

# Build the renderer
echo "Building renderer..."
bun run build:renderer

# Launch Electron with sandbox disabled
# Note: This is a workaround for the sandbox permission issue
export ELECTRON_NO_SANDBOX=1

echo "Launching Zenuxs Desktop..."
node_modules/.bin/electron .

echo "Application closed."
