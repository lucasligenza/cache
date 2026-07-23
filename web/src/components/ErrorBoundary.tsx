import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { reportError } from '../lib/telemetry';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Report the crash instead of swallowing it in prod (telemetry logs in dev
    // and POSTs to VITE_ERROR_REPORT_URL when configured).
    reportError(error, 'react', { componentStack: info.componentStack });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          background: '#1a1a1a',
          fontFamily: "'JetBrains Mono', monospace",
          color: '#E0E0E0',
          gap: '8px',
        }}>
          <div style={{ color: '#FF4444' }}>~/cache $ FATAL ERROR</div>
          <div style={{ color: '#666' }}>segmentation fault (component crashed)</div>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: '16px',
              background: 'none',
              border: '1px solid #333',
              color: '#E0E0E0',
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '12px',
              padding: '6px 16px',
              cursor: 'pointer',
              borderRadius: '2px',
            }}
          >
            [reload]
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
