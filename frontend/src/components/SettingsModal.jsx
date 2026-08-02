import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Globe, Save, RefreshCw } from "lucide-react";
import axios from "axios";

export const SettingsModal = ({ isOpen, onClose, backendUrl, onSave, addToast }) => {
  const [urlInput, setUrlInput] = useState(backendUrl);
  const [isTesting, setIsTesting] = useState(false);

  const handleTest = async () => {
    setIsTesting(true);
    try {
      const res = await axios.get(`${urlInput}/`, { timeout: 4000 });
      if (res.status === 200) {
        addToast("success", "Connection successful! Server is online.");
      } else {
        addToast("warning", `Server returned status code: ${res.status}`);
      }
    } catch (err) {
      console.error(err);
      addToast("error", "Failed to connect to backend server. Check URL.");
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = (e) => {
    e.preventDefault();
    if (!urlInput.trim()) {
      addToast("error", "Backend URL cannot be empty.");
      return;
    }
    const sanitizedUrl = urlInput.trim().replace(/\/$/, "");
    onSave(sanitizedUrl);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 1000 }}>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="modal-backdrop"
          />

          {/* Modal box */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: "-40%" }}
            animate={{ opacity: 1, scale: 1, y: "-50%" }}
            exit={{ opacity: 0, scale: 0.95, y: "-40%" }}
            transition={{ type: "spring", duration: 0.35 }}
            className="modal-box"
          >
            <div className="modal-header">
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Globe size={18} style={{ color: "#3B82F6" }} />
                <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 800 }}>Backend Configuration</h3>
              </div>
              <button onClick={onClose} className="modal-close-btn">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSave}>
              <div className="form-group">
                <label className="form-label">API BACKEND URL</label>
                <input
                  type="url"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="https://your-backend.onrender.com"
                  className="form-input"
                  required
                />
                <span className="form-help-text">
                  Change this to your local server (e.g. <code>http://localhost:5000</code>) or Render service domain.
                </span>
              </div>

              {/* Action buttons */}
              <div className="modal-actions-container">
                <button
                  type="button"
                  onClick={handleTest}
                  disabled={isTesting}
                  className="btn"
                  style={{
                    background: "transparent",
                    borderColor: "#E2E8F0",
                    color: "#475569",
                  }}
                >
                  <RefreshCw size={14} className={isTesting ? "animate-spin" : ""} style={{ color: "#3B82F6" }} />
                  <span>{isTesting ? "Testing..." : "Test Connection"}</span>
                </button>

                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    type="button"
                    onClick={onClose}
                    className="btn"
                    style={{ background: "transparent", color: "#64748B", padding: "10px" }}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary">
                    <Save size={14} />
                    <span>Save URL</span>
                  </button>
                </div>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
