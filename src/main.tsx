import React from 'react';
import { createRoot } from 'react-dom/client';
// Lazy-load App to create a small initial chunk (code-splitting)
const App = React.lazy(() => import('./App.tsx'));
import './index.css';

function showFatalError(title: string, details?: string) {
  try {
    const root = document.getElementById('root');
    if (root) root.style.display = 'none';
    const el = document.createElement('div');
    el.style.cssText = 'padding:24px;font-family:Inter, Roboto, Arial, sans-serif;background:#fff;color:#111;max-width:900px;margin:48px auto;border-radius:8px;box-shadow:0 8px 30px rgba(2,6,23,0.08)';
    el.innerHTML = `<h2 style="margin:0 0 8px;color:#b91c1c">${title}</h2><pre style="white-space:pre-wrap;font-size:13px;color:#111">${details||''}</pre>`;
    document.body.insertBefore(el, document.body.firstChild);
  } catch (e) { console.error('showFatalError failed', e); }
}

// Global handlers to show runtime errors instead of a blank white screen
window.addEventListener('error', (ev: any) => {
  try {
    const msg = ev?.message || String(ev?.error || 'Unknown error');
    const stack = ev?.error?.stack || (ev?.error && String(ev.error)) || '';
    console.error('Runtime error caught', ev);
    showFatalError('Runtime error', msg + '\n' + stack);
  } catch (e) { console.error(e); }
});
window.addEventListener('unhandledrejection', (ev: any) => {
  try {
    const reason = ev?.reason || ev?.detail || 'Unhandled rejection';
    console.error('Unhandled rejection', ev);
    showFatalError('Unhandled promise rejection', String(reason));
  } catch (e) { console.error(e); }
});

const container = document.getElementById('root');
if (!container) throw new Error('Root element #root not found');

class ErrorBoundary extends React.Component<any, {error: any, info?: any}> {
  constructor(props:any){ super(props); this.state = { error: null, info: undefined }; }
  static getDerivedStateFromError(error:any){ return { error }; }
  componentDidCatch(error:any, info:any){ console.error('ErrorBoundary caught', error, info); try{ showFatalError(String(error), info?.componentStack||String(error)); }catch(e){console.error(e);} }
  render(){ if(this.state.error){ return React.createElement('div',{style:{padding:24,background:'#fff',color:'#111',maxWidth:900,margin:'48px auto',borderRadius:8,boxShadow:'0 8px 30px rgba(2,6,23,0.08)'}}, React.createElement('h2', {style:{margin:'0 0 8px',color:'#b91c1c'}}, 'Fatal render error'), React.createElement('pre', {style:{whiteSpace:'pre-wrap',fontSize:13}}, String(this.state.error))); } return this.props.children; }
}

  try {
  createRoot(container).render(
    <React.StrictMode>
      <ErrorBoundary>
        <React.Suspense fallback={<div style={{padding:24}}>Încărcare...</div>}>
          <App />
        </React.Suspense>
      </ErrorBoundary>
    </React.StrictMode>
  );
} catch (err:any) {
  console.error('App bootstrap failed', err);
  showFatalError('App bootstrap failed', String(err?.stack || err));
}

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
  }catch(e){ void e; }
    }).catch(() => {});
  });
}

