import React, { createContext, useContext, useMemo, useState } from "react";

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const api = useMemo(() => ({
    show(message, type = "info") {
      const id = Date.now() + Math.random();
      setToasts((items) => [...items, { id, message, type }]);
      window.setTimeout(() => {
        setToasts((items) => items.filter((toast) => toast.id !== id));
      }, 3600);
    },
    remove(id) {
      setToasts((items) => items.filter((toast) => toast.id !== id));
    },
  }), []);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toast-stack" aria-live="polite" aria-atomic="true">
        {toasts.map((toast) => (
          <button key={toast.id} className={`toast toast-${toast.type}`} onClick={() => api.remove(toast.id)}>
            {toast.message}
          </button>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
