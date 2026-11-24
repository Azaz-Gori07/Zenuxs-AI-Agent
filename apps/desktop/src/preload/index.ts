import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // App info
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  getAppPath: () => ipcRenderer.invoke('get-app-path'),

  // File dialogs
  openFileDialog: (options?: Electron.OpenDialogOptions) =>
    ipcRenderer.invoke('open-file-dialog', options),
  saveFileDialog: (options?: Electron.SaveDialogOptions) =>
    ipcRenderer.invoke('save-file-dialog', options),

  // Notifications
  showNotification: (options: { title: string; body: string; icon?: string }) =>
    ipcRenderer.invoke('show-notification', options),

  // Window control
  newSession: () => ipcRenderer.send('new-session'),

  // Events
  onNewSession: (callback: () => void) => {
    ipcRenderer.on('new-session', callback);
    return () => ipcRenderer.removeListener('new-session', callback);
  },
  onShowAbout: (callback: () => void) => {
    ipcRenderer.on('show-about', callback);
    return () => ipcRenderer.removeListener('show-about', callback);
  },
});
