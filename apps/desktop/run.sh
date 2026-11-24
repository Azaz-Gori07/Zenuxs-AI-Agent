#!/bin/bash

# Launch script with sandbox disabled
cd "$(dirname "$0")"

# Disable Electron sandbox
export ELECTRON_NO_SANDBOX=1

# Launch Electron
electron .
