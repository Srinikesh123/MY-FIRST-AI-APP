import { createContext, useContext, useState, useCallback, useRef } from 'react';
import './Toast.css';

const ToastContext = createContext(null);

let _toastId = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [confirmState, setConfirmState] = useState(null);
  const confirmResolveRef = useRef(null);

  const toast = useCallback((message, type = 'info', duration = 3000) => {
    const id = ++_toastId;
    setToasts(prev => [...prev, { id, message, type }]);
    if (duration > 0) {
      setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), duration);
    }
  }, []);

  const success = useCallback((msg) => toast(msg, 'success'), [toast]);
  const error = useCallback((msg) => toast(msg, 'error', 4000), [toast]);
  const warn = useCallback((msg) => toast(msg, 'warn', 3500), [toast]);
  const info = useCallback((msg) => toast(msg, 'info'), [toast]);

  const confirm = useCallback((message, title = 'Confirm') => {
    return new Promise((resolve) => {
      confirmResolveRef.current = resolve;
      setConfirmState({ title, message });
    });
  }, []);

  const handleConfirm = (result) => {
    confirmResolveRef.current?.(result);
    confirmResolveRef.current = null;
    setConfirmState(null);
  };

  const dismissToast = (id) => setToasts(prev => prev.filter(t => t.id !== id));

  return (
    <ToastContext.Provider value={{ toast, success, error, warn, info, confirm }}>
      {children}

      {/* Toast stack */}
      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className={`toast-item toast-${t.type}`} onClick={() => dismissToast(t.id)}>
            <span className="toast-icon">
              {t.type === 'success' && '✓'}
              {t.type === 'error' && '✕'}
              {t.type === 'warn' && '!'}
              {t.type === 'info' && 'i'}
            </span>
            <span className="toast-msg">{t.message}</span>
          </div>
        ))}
      </div>

      {/* Confirm modal */}
      {confirmState && (
        <div className="confirm-overlay" onClick={() => handleConfirm(false)}>
          <div className="confirm-modal" onClick={e => e.stopPropagation()}>
            <h3 className="confirm-title">{confirmState.title}</h3>
            <p className="confirm-message">{confirmState.message}</p>
            <div className="confirm-actions">
              <button className="confirm-btn cancel" onClick={() => handleConfirm(false)}>Cancel</button>
              <button className="confirm-btn proceed" onClick={() => handleConfirm(true)}>Confirm</button>
            </div>
          </div>
        </div>
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
