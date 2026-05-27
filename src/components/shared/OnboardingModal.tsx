import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import './OnboardingModal.css';

const TOTAL_STEPS = 7;

export const OnboardingModal: React.FC = () => {
    const { state, setHelpModalOpen, setActiveTab } = useApp();
    const [isVisible, setIsVisible] = useState(false);
    const [currentStep, setCurrentStep] = useState(0);
    const touchStartX = useRef<number | null>(null);
    const touchStartY = useRef<number | null>(null);
    const trackRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const hasSeenOnboarding = localStorage.getItem('hasSeenOnboarding_v2');
        if (hasSeenOnboarding) return;

        const hasSeenTutorial = localStorage.getItem('hasSeenTutorial_v1') === 'true';
        if (hasSeenTutorial) {
            setIsVisible(true);
            setCurrentStep(0);
            return;
        }

        const handler = () => {
            setIsVisible(true);
            setCurrentStep(0);
        };
        window.addEventListener('tutorial-complete', handler);
        return () => window.removeEventListener('tutorial-complete', handler);
    }, []);

    useEffect(() => {
        if (state.isHelpModalOpen) {
            setCurrentStep(0);
        }
    }, [state.isHelpModalOpen]);

    const handleDismiss = useCallback(() => {
        localStorage.setItem('hasSeenOnboarding_v2', 'true');
        setIsVisible(false);
        setHelpModalOpen(false);
        setActiveTab('GAMES');
        window.dispatchEvent(new Event('onboarding-complete'));
    }, [setHelpModalOpen, setActiveTab]);

    const goNext = useCallback(() => {
        setCurrentStep(prev => Math.min(prev + 1, TOTAL_STEPS - 1));
    }, []);

    const goBack = useCallback(() => {
        setCurrentStep(prev => Math.max(prev - 1, 0));
    }, []);

    const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (e.target === e.currentTarget) handleDismiss();
    };

    const handleTouchStart = (e: React.TouchEvent) => {
        touchStartX.current = e.touches[0].clientX;
        touchStartY.current = e.touches[0].clientY;
    };

    const handleTouchEnd = (e: React.TouchEvent) => {
        if (touchStartX.current === null || touchStartY.current === null) return;
        const deltaX = e.changedTouches[0].clientX - touchStartX.current;
        const deltaY = e.changedTouches[0].clientY - touchStartY.current;

        if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 40) {
            if (deltaX > 0) goBack();
            else goNext();
        }
        touchStartX.current = null;
        touchStartY.current = null;
    };

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (!isVisible && !state.isHelpModalOpen) return;
            if (e.key === 'Escape') handleDismiss();
            if (e.key === 'ArrowRight') goNext();
            if (e.key === 'ArrowLeft') goBack();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [isVisible, state.isHelpModalOpen, handleDismiss, goNext, goBack]);

    const showModal = isVisible || state.isHelpModalOpen;
    if (!showModal) return null;

    const isLastStep = currentStep === TOTAL_STEPS - 1;
    const isFirstStep = currentStep === 0;

    return (
        <div className="onboarding-overlay" onClick={handleOverlayClick}>
            <div className="onboarding-modal glass-panel">
                <button
                    className="onboarding-close-btn"
                    onClick={handleDismiss}
                    aria-label="Close"
                >
                    ×
                </button>

                <div
                    className={`onboarding-track-wrapper ${currentStep === 0 ? 'onboarding-track-wrapper--bg1' : currentStep === TOTAL_STEPS - 1 ? 'onboarding-track-wrapper--bg5' : ''}`}
                    onTouchStart={handleTouchStart}
                    onTouchEnd={handleTouchEnd}
                    ref={trackRef}
                >
                    <div
                        className="onboarding-step-track"
                        style={{ transform: `translateX(-${currentStep * 100}%)` }}
                    >
                        {/* ── Step 1: Welcome ──────────────────── */}
                        <div className="onboarding-step">
                            <div className="onboarding-step-content onboarding-step--center">
                                <div className="onboarding-welcome-icon">⚽</div>
                                <h2 className="onboarding-title text-gradient">
                                    Predict the 2026 FIFA World Cup
                                </h2>
                                <p className="onboarding-intro">
                                    Browse the daily match schedule, predict group &amp; knockout games for bonus points,
                                    and pick the tournament's top awards.
                                    Every prediction earns points — compete on the global leaderboard.
                                </p>
                            </div>
                        </div>

                        {/* ── Step 2: Your Dashboard ──────────── */}
                        <div className="onboarding-step">
                            <div className="onboarding-step-content onboarding-step--center">
                                <h3 className="onboarding-section-title">Your Dashboard</h3>

                                <div className="onboarding-layout-preview">
                                    <h4 className="onboarding-layout-title">Desktop</h4>
                                    <div className="onboarding-mock-header">
                                        <div className="mock-tabs">
                                            <span className="mock-tab active">Games</span>
                                            <span className="mock-tab">Positions</span>
                                            <span className="mock-tab">Bracket</span>
                                            <span className="mock-tab">Awards</span>
                                            <span className="mock-tab">Summary</span>
                                            <span className="mock-tab">Leader</span>
                                        </div>
                                        <div className="mock-progress">
                                            <div className="mock-ring-fill" />
                                            <span className="mock-ring-pct">45%</span>
                                        </div>
                                    </div>
                                    <p className="onboarding-mock-caption">
                                        The <strong>progress ring</strong> tracks your prediction completion across Positions, Bracket, and Awards so you always know how far you are.
                                    </p>
                                    <p className="onboarding-layout-text" style={{marginTop: '0.5rem'}}>
                                        <span className="mock-fab-icon mock-fab-green">💾</span>
                                        <strong>Save anytime</strong> — the floating save button lives on every page.
                                    </p>
                                </div>

                                <div className="onboarding-layout-preview" style={{marginTop: '0.75rem'}}>
                                    <h4 className="onboarding-layout-title">Mobile</h4>
                                    <div className="onboarding-mock-bottom-nav">
                                        <span className="mock-nav-icon">📅</span>
                                        <span className="mock-nav-icon">⚽</span>
                                        <span className="mock-nav-icon">⚔</span>
                                        <span className="mock-nav-icon">🏅</span>
                                        <span className="mock-nav-icon">📝</span>
                                        <span className="mock-nav-icon">🏆</span>
                                    </div>
                                    <span className="onboarding-mobile-label">📱 Bottom nav bar for thumb‑reachable tabs</span>
                                </div>
                            </div>
                        </div>

                        {/* ── Step 3: How It Works ─────────────── */}
                        <div className="onboarding-step">
                            <div className="onboarding-step-content">
                                <h3 className="onboarding-section-title">Your Prediction Journey</h3>
                                <p className="onboarding-points-hint" style={{marginBottom: '0.75rem'}}>
                                    Pre-tournament predictions drive your bracket. Games are bonus during the tournament.
                                </p>

                                <div className="onboarding-points-card">
                                    <h4 className="onboarding-points-card-title">🔮 Pre‑Tournament</h4>
                                    <div className="onboarding-flow-steps">
                                        <div className="onboarding-flow-step">
                                            <span className="flow-step-icon">⚽</span>
                                            <div className="flow-step-body">
                                                <strong>Group Positions</strong>
                                                <span>Drag teams 1st–4th for all 12 groups — no match scores!</span>
                                            </div>
                                        </div>
                                        <div className="onboarding-flow-arrow">→</div>
                                        <div className="onboarding-flow-step">
                                            <span className="flow-step-icon">🥉</span>
                                            <div className="flow-step-body">
                                                <strong>Select Thirds</strong>
                                                <span>Manually pick 8 of the 12 third-place teams to advance</span>
                                            </div>
                                        </div>
                                        <div className="onboarding-flow-arrow">→</div>
                                        <div className="onboarding-flow-step">
                                            <span className="flow-step-icon">⚔️</span>
                                            <div className="flow-step-body">
                                                <strong>Bracket</strong>
                                                <span>Auto‑seeded from your positions &amp; thirds — R32 to Champ</span>
                                            </div>
                                        </div>
                                    </div>
                                    <p className="onboarding-points-example">
                                        <strong>Quick start:</strong> Use Auto‑Fill (🎲) in the Positions toolbar to randomly shuffle all groups, then jump to Thirds!
                                    </p>
                                </div>

                                <div className="onboarding-points-card" style={{marginTop: '0.5rem'}}>
                                    <h4 className="onboarding-points-card-title">🎮 In‑Tournament</h4>
                                    <div className="onboarding-flow-step">
                                        <span className="flow-step-icon">📅</span>
                                        <div className="flow-step-body">
                                            <strong>Games</strong>
                                            <span>Bonus points predicting match scores — 72 group + 32 knockout games</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="onboarding-points-card" style={{marginTop: '0.5rem'}}>
                                    <h4 className="onboarding-points-card-title">🏆 Independent Picks</h4>
                                    <div className="onboarding-flow-steps">
                                        <div className="onboarding-flow-step">
                                            <span className="flow-step-icon">🎖️</span>
                                            <div className="flow-step-body">
                                                <strong>Awards</strong>
                                                <span>Predict Golden Ball, Golden Boot &amp; Golden Glove</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* ── Step 4: Points — Matches ─────────── */}
                        <div className="onboarding-step">
                            <div className="onboarding-step-content">
                                <h3 className="onboarding-section-title">Points — Matches &amp; Bracket</h3>

                                <div className="onboarding-points-card">
                                    <h4 className="onboarding-points-card-title">📊 Group Positions</h4>
                                    <p className="onboarding-points-hint">Per correctly predicted position (1st–4th)</p>
                                    <div className="onboarding-points-rows">
                                        <div className="onboarding-points-row">
                                            <span className="onboarding-points-label">Correct position</span>
                                            <span className="onboarding-points-value">2 pts</span>
                                        </div>
                                        <div className="onboarding-points-row onboarding-points-row--muted">
                                            <span className="onboarding-points-label">Wrong position</span>
                                            <span className="onboarding-points-value">0 pts</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="onboarding-points-card">
                                    <h4 className="onboarding-points-card-title">🎮 Games (Bonus)</h4>
                                    <p className="onboarding-points-hint">Predict individual match scores during the tournament</p>
                                    <div className="onboarding-points-rows">
                                        <div className="onboarding-points-row">
                                            <span className="onboarding-points-label">Exact score</span>
                                            <span className="onboarding-points-value">2 pts</span>
                                        </div>
                                        <div className="onboarding-points-row">
                                            <span className="onboarding-points-label">Correct result only</span>
                                            <span className="onboarding-points-value">1 pt</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="onboarding-points-card">
                                    <h4 className="onboarding-points-card-title">⚔️ Knockout Bracket</h4>
                                    <p className="onboarding-points-hint">Per team reaching each round</p>
                                    <div className="onboarding-points-rows">
                                        <div className="onboarding-points-row">
                                            <span className="onboarding-points-label">Round of 32</span>
                                            <span className="onboarding-points-value">2 pts</span>
                                        </div>
                                        <div className="onboarding-points-row">
                                            <span className="onboarding-points-label">Round of 16</span>
                                            <span className="onboarding-points-value">5 pts</span>
                                        </div>
                                        <div className="onboarding-points-row">
                                            <span className="onboarding-points-label">Quarter-Finals</span>
                                            <span className="onboarding-points-value">10 pts</span>
                                        </div>
                                        <div className="onboarding-points-row">
                                            <span className="onboarding-points-label">Semi-Finals</span>
                                            <span className="onboarding-points-value">15 pts</span>
                                        </div>
                                        <div className="onboarding-points-row">
                                            <span className="onboarding-points-label">Final</span>
                                            <span className="onboarding-points-value">20 pts</span>
                                        </div>
                                        <div className="onboarding-points-row onboarding-points-row--highlight">
                                            <span className="onboarding-points-label">Champion 🏆</span>
                                            <span className="onboarding-points-value">25 pts</span>
                                        </div>
                                    </div>
                                    <p className="onboarding-points-example">
                                        A champion pick alone earns 2 + 5 + 10 + 15 + 20 + 25 = <strong>77 points</strong>
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* ── Step 5: Points — Awards ────────────── */}
                        <div className="onboarding-step">
                            <div className="onboarding-step-content">
                                <h3 className="onboarding-section-title">Points — Awards</h3>

                                <div className="onboarding-points-card">
                                    <h4 className="onboarding-points-card-title">🏅 Awards</h4>
                                    <div className="onboarding-points-rows">
                                        <div className="onboarding-points-row">
                                            <span className="onboarding-points-label">Golden Ball, Golden Boot, Golden Glove</span>
                                            <span className="onboarding-points-value">10 pts each</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="onboarding-points-card">
                                    <h4 className="onboarding-points-card-title">💡 How You Score</h4>
                                    <p className="onboarding-leaderboard-text">
                                        Your total combines Group Positions + Bracket + Games Bonus + Awards points.
                                        The leaderboard updates live as official results come in.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* ── Step 6: Saving Your Predictions ──── */}
                        <div className="onboarding-step">
                            <div className="onboarding-step-content">
                                <h3 className="onboarding-section-title">Saving Your Predictions</h3>
                                <p className="onboarding-points-hint">The save button lives in the bottom‑right corner of every page</p>

                                <div className="onboarding-points-card">
                                    <h4 className="onboarding-points-card-title">💾 Save Button States</h4>
                                    <div className="onboarding-fab-states">
                                        <div className="fab-state-row">
                                            <span className="fab-state-icon fab-state-green">💾</span>
                                            <span className="fab-state-label">Green glow = all saved — you're good!</span>
                                        </div>
                                        <div className="fab-state-row">
                                            <span className="fab-state-icon fab-state-purple">💾</span>
                                            <span className="fab-state-label">Purple pulse + rings = unsaved changes — tap to save</span>
                                        </div>
                                        <div className="fab-state-row">
                                            <span className="fab-state-icon fab-state-saving">⏳</span>
                                            <span className="fab-state-label">Pulsing = saving in progress…</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="onboarding-points-card">
                                    <h4 className="onboarding-points-card-title">🔧 Positions Toolbar</h4>
                                    <div className="onboarding-fab-states">
                                        <div className="fab-state-row">
                                            <span className="step-icon">🎲</span>
                                            <span className="fab-state-label">Auto‑Fill Positions — random group rankings</span>
                                        </div>
                                        <div className="fab-state-row">
                                            <span className="step-icon">🗑️</span>
                                            <span className="fab-state-label">Reset — clear all predictions</span>
                                        </div>
                                        <div className="fab-state-row">
                                            <span className="step-icon">🥉</span>
                                            <span className="fab-state-label">Select Thirds — pick 8 third‑place teams for the bracket</span>
                                        </div>
                                    </div>
                                </div>

                                <p className="onboarding-points-example">
                                    Hover the save button on desktop to see <strong>"Save Predictions"</strong>. Tap anytime — your work is safe.
                                </p>

                                <div className="onboarding-max-score" style={{marginTop: '0.75rem'}}>
                                    💡 Summary tab is always visible — dimmed until you finish all predictions.
                                </div>
                            </div>
                        </div>

                        {/* ── Step 7: Rules & Ready ────────────── */}
                        <div className="onboarding-step">
                            <div className="onboarding-step-content onboarding-step--center">
                                <h3 className="onboarding-section-title">Rules</h3>
                                <p className="onboarding-rules-text" style={{ marginTop: '0.25rem' }}>
                                    ⚠️ Matches lock 1 hour before kickoff. Once locked, predictions cannot be changed.
                                    Keep an eye on the countdown badges across <strong>Games</strong>, Positions, and Bracket.
                                </p>
                                <div className="onboarding-max-score">
                                    🏅 Maximum possible score: ~475  points (plus Games bonus)
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── Bottom Bar ─────────────────────────────── */}
                <div className="onboarding-bottom-bar">
                    <button
                        className={`onboarding-nav-btn onboarding-nav-btn--back ${isFirstStep ? 'onboarding-nav-btn--hidden' : ''}`}
                        onClick={goBack}
                        disabled={isFirstStep}
                        aria-label="Previous step"
                    >
                        ← Back
                    </button>

                    <div className="onboarding-dots">
                        {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
                            <button
                                key={i}
                                className={`onboarding-dot ${i === currentStep ? 'onboarding-dot--active' : ''}`}
                                onClick={() => setCurrentStep(i)}
                                aria-label={`Go to step ${i + 1}`}
                            />
                        ))}
                    </div>

                    {isLastStep ? (
                        <button className="onboarding-cta-btn" onClick={handleDismiss}>
                            <span className="onboarding-button-text">Let's Predict!</span>
                            <span className="onboarding-button-arrow">→</span>
                        </button>
                    ) : (
                        <button className="onboarding-nav-btn onboarding-nav-btn--next" onClick={goNext}>
                            Next →
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};
