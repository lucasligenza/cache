import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import type { ReactNode } from 'react';
import './Toast.css';

type ToastType = 'error' | 'ok' | 'warn';

interface ToastOptions {
  actionLabel?: string;
  onAction?: () => void;
  duration?: number;
}

interface ToastItem {
  id: number;
  type: ToastType;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

interface ToastContextValue {
  showToast: (type: ToastType, message: string, options?: ToastOptions) => void;
}

const ToastContext = createContext<ToastContextValue>({ showToast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(0);
  const timersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());

  const showToast = useCallback((type: ToastType, message: string, options?: ToastOptions) => {
    const id = ++idRef.current;
    setToasts(prev => {
      const next = [...prev, { id, type, message, actionLabel: options?.actionLabel, onAction: options?.onAction }];
      return next.length > 3 ? next.slice(next.length - 3) : next;
    });
    const timer = setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
      timersRef.current.delete(timer);
    }, options?.duration ?? 4000);
    timersRef.current.add(timer);
  }, []);

  useEffect(() => {
    const timers = timersRef.current;
    return () => timers.forEach(clearTimeout);
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const runAction = useCallback((toast: ToastItem) => {
    toast.onAction?.();
    setToasts(prev => prev.filter(t => t.id !== toast.id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="toast-stack" role="region" aria-live="polite" aria-label="notifications">
        {toasts.map(toast => (
          <div key={toast.id} className={`toast toast--${toast.type}`}>
            <div className="toast__content">
              <span className="toast__label">{toast.type}</span>
              <span className="toast__message">{toast.message}</span>
            </div>
            {toast.actionLabel && toast.onAction && (
              <button className="toast__action" onClick={() => runAction(toast)}>
                [{toast.actionLabel}]
              </button>
            )}
            <button className="toast__dismiss" onClick={() => dismiss(toast.id)}>×</button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
