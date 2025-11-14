// components/ErrorMessage.tsx - Error display component with retry button

import React from "react";
import { ErrorInfo } from "../utils/errorHandler";

type Props = {
  error: ErrorInfo;
  onRetry?: () => void;
  onDismiss?: () => void;
};

export default function ErrorMessage({ error, onRetry, onDismiss }: Props) {
  return (
    <div className="error-banner">
      <div className="error-content">
        <span className="error-icon">⚠️</span>
        <div className="error-text">
          <p className="error-message">{error.userMessage}</p>
          <p className="error-detail">{error.type}</p>
        </div>
      </div>
      <div className="error-actions">
        {error.canRetry && onRetry && (
          <button className="btn-error-retry" onClick={onRetry}>
            🔄 Coba Lagi
          </button>
        )}
        {onDismiss && (
          <button className="btn-error-dismiss" onClick={onDismiss}>
            ✕
          </button>
        )}
      </div>
    </div>
  );
}
