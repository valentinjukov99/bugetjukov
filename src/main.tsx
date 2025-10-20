import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

const container = document.getElementById('root');
if (!container) throw new Error('Root element #root not found');

createRoot(container).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then((reg) => {
      try{
        // If there's an active waiting service worker, ask it to skip waiting
        if (reg.waiting) {
          reg.waiting.postMessage({type: 'SKIP_WAITING'});
          // reload to activate the new service worker
          setTimeout(()=>location.reload(), 500);
        }
        // Listen for updates in the future
        reg.addEventListener('updatefound', () => {
          const installing = reg.installing;
          if (!installing) return;
          installing.addEventListener('statechange', () => {
            if (installing.state === 'installed' && navigator.serviceWorker.controller) {
              // new update installed, tell it to activate now
              installing.postMessage({type: 'SKIP_WAITING'});
            }
          });
        });
      }catch(e){}
    }).catch(() => {});
  });
}

