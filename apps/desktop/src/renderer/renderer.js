import { createRoot } from 'react-dom/client';
import React from 'react';
import App from './App';

// Initialize the renderer
const container = document.getElementById('app');
if (!container) {
  console.error('App container not found');
  throw new Error('App container not found');
}

const root = createRoot(container);
root.render(<App />);
