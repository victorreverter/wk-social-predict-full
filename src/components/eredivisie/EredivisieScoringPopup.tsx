import React, { useCallback, useEffect, useState } from 'react';

const DISMISSED_KEY = 'eredivisieScoringDismissed';

interface Props {
  onClose: () => void;
}

export const EredivisieScoringPopup: React.FC<Props> = ({ onClose }) => {
  const [dontShowAgain, setDontShowAgain] = useState(false);

  const handleGotIt = useCallback(() => {
    if (dontShowAgain) {
      localStorage.setItem(DISMISSED_KEY, 'true');
    }
    onClose();
  }, [dontShowAgain, onClose]);

  const handleOverlayClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  }, [onClose]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  return (
    <div className="eredivisie-scoring-overlay" onClick={handleOverlayClick}>
      <div className="eredivisie-scoring-card glass-panel">
        <button
          className="eredivisie-scoring-close"
          onClick={onClose}
          aria-label="Close"
        >
          &times;
        </button>

        <h2 className="text-gradient">How Eredivisie Points Work</h2>

        <div className="eredivisie-scoring-items">
          <div className="eredivisie-scoring-item exact">
            <span className="eredivisie-scoring-pts">5 pts</span>
            <span className="eredivisie-scoring-desc">Exact score prediction</span>
            <span className="eredivisie-scoring-example">You predict 2-1, result is 2-1</span>
          </div>
          <div className="eredivisie-scoring-item result">
            <span className="eredivisie-scoring-pts">2 pts</span>
            <span className="eredivisie-scoring-desc">Correct result, wrong score</span>
            <span className="eredivisie-scoring-example">You predict a home win, and the home team wins</span>
          </div>
          <div className="eredivisie-scoring-item wrong">
            <span className="eredivisie-scoring-pts">0 pts</span>
            <span className="eredivisie-scoring-desc">Wrong result</span>
            <span className="eredivisie-scoring-example">You predict a draw, but someone wins</span>
          </div>
        </div>

        <div className="eredivisie-scoring-footer">
          <label className="eredivisie-scoring-checkbox">
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={(e) => setDontShowAgain(e.target.checked)}
            />
            Don't show again
          </label>
          <button className="btn-primary" onClick={handleGotIt}>
            Got it!
          </button>
        </div>
      </div>
    </div>
  );
};

export function isEredivisieScoringDismissed(): boolean {
  return localStorage.getItem(DISMISSED_KEY) === 'true';
}
