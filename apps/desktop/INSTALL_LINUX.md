# Installation Guide for Linux

## Method 1: Download Pre-built Package (Recommended)

### AppImage (Universal)

1. Download the AppImage:
```bash
wget https://github.com/Azaz-Gori07/Zenuxs-AI-Agent/releases/latest/download/Zenuxs-Desktop-x86_64.AppImage
```

2. Make it executable:
```bash
chmod +x Zenuxs-Desktop-x86_64.AppImage
```

3. Run it:
```bash
./Zenuxs-Desktop-x86_64.AppImage
```

### Debian Package (Debian/Ubuntu/Mint)

1. Download the .deb package:
```bash
wget https://github.com/Azaz-Gori07/Zenuxs-AI-Agent/releases/latest/download/zenuxs-desktop_1.0.0_amd64.deb
```

2. Install it:
```bash
sudo dpkg -i zenuxs-desktop_1.0.0_amd64.deb
```

3. Run it:
```bash
zenuxs-desktop
```

### RPM Package (Fedora/RHEL/CentOS)

1. Download the .rpm package:
```bash
wget https://github.com/Azaz-Gori07/Zenuxs-AI-Agent/releases/latest/download/zenuxs-desktop-1.0.0.x86_64.rpm
```

2. Install it:
```bash
sudo rpm -i zenuxs-desktop-1.0.0.x86_64.rpm
```

3. Run it:
```bash
zenuxs-desktop
```

## Method 2: Build from Source

### Prerequisites

1. **Node.js 18+**:
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

2. **Bun**:
```bash
curl -fsSL https://bun.sh/install | bash
```

3. **Build tools** (for AppImage):
```bash
sudo apt-get update
sudo apt-get install -y build-essential fuse libfuse2
```

### Build Steps

1. Clone the repository:
```bash
git clone https://github.com/Azaz-Gori07/Zenuxs-AI-Agent.git
cd Zenuxs-AI-Agent
cd apps/desktop
```

2. Install dependencies:
```bash
bun install
```

3. Build the application:
```bash
# Quick start (development mode)
./scripts/quick-start.sh

# Or build for distribution
./scripts/build-linux.sh
```

4. Run the built application:
```bash
bun run start
```

## Method 3: Flatpak (Alternative)

1. Add Flathub repository:
```bash
sudo flatpak remote-add --if-not-exists flathub https://flathub.org/repo/flathub.flatpakrepo
```

2. Install Zenuxs Desktop:
```bash
flatpak install flathub com.zenuxs.desktop
```

3. Run it:
```bash
flatpak run com.zenuxs.desktop
```

## Post-Installation

### First Run

1. Open Zenuxs Desktop
2. Complete the onboarding if prompted
3. Configure your AI provider (OpenAI, Anthropic, etc.)
4. Start using the application!

### System Tray Integration

The application will automatically integrate with your system tray. You can:

- Click the tray icon to minimize/close
- Right-click for quick actions (Open, Quit)
- See connection status

### File Dialog Integration

The application will use your system's native file dialogs for:

- Opening files
- Saving files
- Selecting directories

## Troubleshooting

### AppImage Won't Run

If you get permission errors:

```bash
# Add to FUSE group
sudo usermod -aG fuse $USER

# Log out and log back in
```

### Dependencies Missing

If you get library errors:

```bash
# For AppImage
./Zenuxs-Desktop-x86_64.AppImage --appimage-extract
cd squashfs-root
./usr/bin/zenuxs-desktop

# Or install dependencies
sudo apt-get install -y libgtk-3-0 libnotify4 libnss3 libxss1 libxtst6 libatspi2.0-0 libdrm2 libgbm1 libcups2 libdbus-1-3 libxcomposite1 libxdamage1 libxfixes3 libxkbcommon0 libxrandr2 libasound2
```

### Building Fails

If build fails:

1. Clean and reinstall:
```bash
rm -rf node_modules bun.lock
bun install
```

2. Check Node.js and Bun versions:
```bash
node --version  # Should be >= 18
bun --version   # Should be >= 1
```

3. Try with sudo if needed:
```bash
sudo bun install
sudo bun run build
```

## Uninstallation

### From AppImage

Simply delete the AppImage file:
```bash
rm ~/Zenuxs-Desktop-x86_64.AppImage
```

### From Debian Package

```bash
sudo apt-get remove zenuxs-desktop
```

### From RPM Package

```bash
sudo rpm -e zenuxs-desktop
```

### From Flatpak

```bash
flatpak uninstall com.zenuxs.desktop
```

## Support

If you encounter any issues:

1. Check the [README](README.md) for documentation
2. Review [Troubleshooting](#troubleshooting) section
3. Open an issue on GitHub: https://github.com/Azaz-Gori07/Zenuxs-AI-Agent/issues
4. Check existing issues for similar problems

## Updates

### Automatic Updates (AppImage)

AppImage typically handles updates by downloading new versions. You can:

1. Download the new version
2. Replace the old file
3. Keep the executable permission

### Manual Updates

1. Download the latest package
2. Install over the existing version
3. Launch the updated application

## License

Zenuxs Desktop is licensed under Apache 2.0. See the LICENSE file for details.
