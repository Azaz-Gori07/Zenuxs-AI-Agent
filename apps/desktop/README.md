# Zenuxs Desktop Application

A Linux-compatible desktop application for Zenuxs AI Agent with a sleek black and white theme.

## Features

- 🎨 **Black & White Theme**: Clean, minimalist design
- 💬 **Interactive Chat**: Real-time AI chat interface
- 📊 **Multiple Views**: Chat, Sessions, Tools, and MCP Servers
- ⚡ **Fast Performance**: Built with Electron and React
- 🖱️ **Keyboard Shortcuts**: Ctrl+N for new session, Ctrl+Enter to send
- 📁 **File Dialogs**: Native file picker integration
- 🔔 **Notifications**: System notification support
- 🖥️ **System Tray**: Minimize to tray with quick access

## Installation

### Prerequisites

- Node.js >= 18.0.0
- Bun >= 1.0.0

### Build from Source

1. Clone the repository:
```bash
git clone https://github.com/Azaz-Gori07/Zenuxs-AI-Agent.git
cd Zenuxs-AI-Agent
```

2. Navigate to the desktop app directory:
```bash
cd apps/desktop
```

3. Install dependencies:
```bash
bun install
```

4. Build the application:
```bash
bun run build
```

## Running the Application

### Development Mode

```bash
bun run dev
```

This will:
1. Build the renderer (TUI) code
2. Start Electron in development mode

### Production Mode

```bash
bun run start
```

## Usage

### Basic Controls

- **Ctrl+N**: Create new session
- **Ctrl+Enter**: Send message
- **Ctrl+R**: Reload window
- **Ctrl+Shift+I**: Open developer tools
- **F11**: Toggle fullscreen
- **Ctrl+Q**: Quit application

### Navigation

- **Sidebar**: Switch between Chat, Sessions, Tools, and MCP Servers views
- **Message Input**: Type your message and press Enter or click send button

## Building for Distribution

### Linux

Build AppImage:
```bash
bun run package --linux appimage
```

Build Debian package:
```bash
bun run package --linux deb
```

Build RPM package:
```bash
bun run package --linux rpm
```

### macOS

Build DMG:
```bash
bun run package --mac dmg
```

Build ZIP:
```bash
bun run package --mac zip
```

### Windows

Build NSIS installer:
```bash
bun run package --win nsis
```

Build portable executable:
```bash
bun run package --win portable
```

## Architecture

```
apps/desktop/
├── src/
│   ├── main/           # Electron main process
│   │   └── index.ts    # Main entry point, window management, IPC handlers
│   ├── renderer/       # React renderer (desktop UI)
│   │   ├── App.tsx     # Main React component
│   │   ├── index.html  # HTML template
│   │   ├── styles.css  # Black & white theme
│   │   └── renderer.js # Renderer entry point
│   └── preload/        # IPC bridge
│       └── index.ts    # Preload script exposing electronAPI
├── package.json        # Dependencies and build scripts
├── tsconfig.json       # TypeScript configuration
└── README.md           # This file
```

## Integration with Zenuxs CLI

The desktop app can be integrated with the existing Zenuxs CLI by:

1. **Backend Communication**: Use the CLI's HTTP API (`zenuxs-hub`) for agent communication
2. **Tool Execution**: Leverage the CLI's tool registry
3. **Session Management**: Use the CLI's session persistence

See `apps/zenuxs-hub` for the HTTP API implementation.

## Development

### Adding New Features

1. **Main Process**: Edit `src/main/index.ts`
2. **Renderer**: Edit `src/renderer/App.tsx` and `styles.css`
3. **IPC Bridge**: Update `src/preload/index.ts`

### Styling

The application uses CSS variables for theming. Modify `styles.css` to change colors:

```css
:root {
  --bg-primary: #000000;
  --bg-secondary: #0a0a0a;
  --text-primary: #ffffff;
  /* ... more variables */
}
```

## Troubleshooting

### Build Issues

If you encounter build errors:

1. Clear node_modules and reinstall:
```bash
rm -rf node_modules bun.lock
bun install
```

2. Check Node.js and Bun versions:
```bash
node --version
bun --version
```

### Runtime Issues

If the application doesn't start:

1. Check if Electron is installed:
```bash
ls node_modules/electron
```

2. Try running in development mode to see error logs:
```bash
bun run dev
```

## License

This project is licensed under the Apache 2.0 License - see the LICENSE file in the repository for details.

## Contributing

Contributions are welcome! Please read our contributing guidelines before submitting pull requests.
