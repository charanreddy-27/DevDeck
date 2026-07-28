'use client';

import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

const ToastContext = createContext(null);

const TITLES = { success: 'Done', error: 'Failed', info: 'Heads up' };

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback(
    (message, options = {}) => {
      const id = ++idRef.current;
      const tone = options.tone || 'info';
      setToasts((current) => [...current, { id, message, tone, title: options.title || TITLES[tone] }]);
      if (options.duration !== 0) {
        setTimeout(() => dismiss(id), options.duration || 6000);
      }
      return id;
    },
    [dismiss],
  );

  const value = useMemo(
    () => ({
      toast: push,
      success: (message, options) => push(message, { ...options, tone: 'success' }),
      error: (message, options) => push(message, { ...options, tone: 'error' }),
      info: (message, options) => push(message, { ...options, tone: 'info' }),
      dismiss,
    }),
    [push, dismiss],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-stack" role="status" aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast toast-${toast.tone}`}>
            <div className="toast-body">
              <div className="toast-title">{toast.title}</div>
              <div className="toast-msg">{toast.message}</div>
            </div>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => dismiss(toast.id)} aria-label="Dismiss">
              x
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used inside <ToastProvider>.');
  return context;
}
