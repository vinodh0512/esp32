import React, { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from "lucide-react";

export const Toast = ({ toasts, removeToast }) => {
  return (
    <div className="toast-container">
      <AnimatePresence>
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={removeToast} />
        ))}
      </AnimatePresence>
    </div>
  );
};

const ToastItem = ({ toast, onDismiss }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss(toast.id);
    }, toast.duration || 4000);

    return () => clearTimeout(timer);
  }, [toast, onDismiss]);

  const icons = {
    success: <CheckCircle2 size={18} style={{ color: "#10B981" }} />,
    error: <XCircle size={18} style={{ color: "#EF4444" }} />,
    warning: <AlertTriangle size={18} style={{ color: "#F59E0B" }} />,
    info: <Info size={18} style={{ color: "#3B82F6" }} />,
  };

  const styles = {
    success: { borderColor: "#A7F3D0", background: "#F0FDF4" },
    error: { borderColor: "#FCA5A5", background: "#FEF2F2" },
    warning: { borderColor: "#FDE68A", background: "#FFFBEB" },
    info: { borderColor: "#BFDBFE", background: "#EFF6FF" },
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: 50, scale: 0.95 }}
      transition={{ type: "spring", stiffness: 300, damping: 25 }}
      className="toast-item"
      style={styles[toast.type]}
    >
      <div className="toast-content-group">
        {icons[toast.type]}
        <p className="toast-text">{toast.message}</p>
      </div>
      <button onClick={() => onDismiss(toast.id)} className="toast-close-btn">
        <X size={14} />
      </button>
    </motion.div>
  );
};
