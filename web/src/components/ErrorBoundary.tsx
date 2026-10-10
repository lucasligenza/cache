import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { reportError } from '../lib/telemetry';
import './ErrorBoundary.css';

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
        <div className="crash-screen" role="alert">
          <div className="crash-screen__title">~/cache $ FATAL ERROR</div>
          <div className="crash-screen__msg">segmentation fault (component crashed)</div>
          <button className="crash-screen__reload" onClick={() => window.location.reload()}>
            [reload]
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
