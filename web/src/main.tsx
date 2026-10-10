import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/700.css';
import './index.css';
import App from './App';
import { ToastProvider } from './components/Toast';
import { ErrorBoundary } from './components/ErrorBoundary';
import { initTelemetry } from './lib/telemetry';
import { startPwa } from './lib/pwaUpdate';
// Last, so its platform overrides follow every component stylesheet.
import './pwa.css';

// Capture uncaught errors + unhandled rejections (inert until VITE_SENTRY_DSN or
// VITE_ERROR_REPORT_URL is set).
initTelemetry();
void startPwa();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <ToastProvider>
        <App />
      </ToastProvider>
    </ErrorBoundary>
  </StrictMode>
);
