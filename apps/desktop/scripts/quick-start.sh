#!/bin/bash

# Quick start script for Zenuxs Desktop

set -e

echo "[ROCKET] Starting Zenuxs Desktop..."

# Check if bun is installed
if ! command -v bun &> /dev/null; then
    echo "[X] Bun is not installed. Please install it from https://bun.sh"
    exit 1
fi

# Check if we need to install dependencies
if [ ! -d "node_modules" ]; then
    echo "[PACKAGE] Installing dependencies..."
    bun install
fi

# Build renderer and start
echo "[TOOL] Building renderer..."
bun run build:renderer

echo "[GAME] Starting application..."
bun run dev
