import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        window.__chessTrainerSWRegistration = registration;

        const maybeNotifyUpdate = (installingWorker) => {
          if (!installingWorker) {
            return;
          }
          installingWorker.addEventListener('statechange', () => {
            if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
              window.dispatchEvent(new Event('sw-update-available'));
            }
          });
        };

        if (registration.waiting) {
          window.dispatchEvent(new Event('sw-update-available'));
        }

        registration.addEventListener('updatefound', () => {
          maybeNotifyUpdate(registration.installing);
        });
      })
      .catch((error) => {
        console.error('Service worker registration failed:', error);
      });
  });
}
