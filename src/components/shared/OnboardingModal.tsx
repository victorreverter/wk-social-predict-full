import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import './OnboardingModal.css';

const TOTAL_STEPS = 5;

export const OnboardingModal: React.FC = () => {
    const { state, setHelpModalOpen } = useApp();
    const [isVisible, setIsVisible] = useState(false);
    const [currentStep, setCurrentStep] = useState(0);
    const touchStartX = useRef<number | null>(null);
    const touchStartY = useRef<number | null>(null);
    const trackRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const hasSeenOnboarding = localStorage.getItem('hasSeenOnboarding');
        if (!hasSeenOnboarding) {
            setIsVisible(true);
            setCurrentStep(0);
        }
    }, []);

    const handleDismiss = useCallback(() => {
        localStorage.setItem('hasSeenOnboarding', 'true');
        setIsVisible(false);
        setHelpModalOpen(false);
    }, [setHelpModalOpen]);

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
                    className="onboarding-track-wrapper"
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
                                    Group matches, knockout bracket, awards, and the Best XI.
                                    Every prediction earns points — compete on the global leaderboard.
                                </p>
                            </div>
                        </div>

                        {/* ── Step 2: How It Works ─────────────── */}
                        <div className="onboarding-step">
                            <div className="onboarding-step-content">
                                <h3 className="onboarding-section-title">How It Works</h3>
                                <ul className="onboarding-steps">
                                    <li>
                                        <span className="step-icon">🏆</span>
                                        <div className="step-text">
                                            <strong>Group Stage</strong>
                                            Predict all 72 group matches. Use <em>Easy Mode</em> for quick winner picks, or <em>Hard Mode</em> for exact scores.
                                        </div>
                                    </li>
                                    <li>
                                        <span className="step-icon">⚡</span>
                                        <div className="step-text">
                                            <strong>Auto-Fill</strong>
                                            Short on time? Auto-Fill instantly simulates every group match for you.
                                            <em className="onboarding-autofill-note">
                                                Results are completely random — no football knowledge or bias involved.
                                            </em>
                                        </div>
                                    </li>
                                    <li>
                                        <span className="step-icon">🥉</span>
                                        <div className="step-text">
                                            <strong>Third Place</strong>
                                            Once groups finish, pick the 8 best third-placed teams to complete the Round of 32.
                                        </div>
                                    </li>
                                    <li>
                                        <span className="step-icon">⚔️</span>
                                        <div className="step-text">
                                            <strong>Knockout Bracket</strong>
                                            Progress teams through the bracket — Round of 32 all the way to the Final.
                                        </div>
                                    </li>
                                    <li>
                                        <span className="step-icon">🎖️</span>
                                        <div className="step-text">
                                            <strong>Awards &amp; Best XI</strong>
                                            Predict the 11 FIFA award winners and the Tournament's Best XI (1 GK + 10 field players).
                                        </div>
                                    </li>
                                </ul>
                            </div>
                        </div>

                        {/* ── Step 3: Points — Matches ─────────── */}
                        <div className="onboarding-step">
                            <div className="onboarding-step-content">
                                <h3 className="onboarding-section-title">Points — Matches &amp; Bracket</h3>

                                <div className="onboarding-points-card">
                                    <h4 className="onboarding-points-card-title">🎯 Group Stage Matches</h4>
                                    <div className="onboarding-points-rows">
                                        <div className="onboarding-points-row">
                                            <span className="onboarding-points-label">Exact score</span>
                                            <span className="onboarding-points-value">3 pts</span>
                                        </div>
                                        <div className="onboarding-points-row">
                                            <span className="onboarding-points-label">Correct result only</span>
                                            <span className="onboarding-points-value">1 pt</span>
                                        </div>
                                        <div className="onboarding-points-row onboarding-points-row--muted">
                                            <span className="onboarding-points-label">Wrong result</span>
                                            <span className="onboarding-points-value">0 pts</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="onboarding-points-card">
                                    <h4 className="onboarding-points-card-title">⚔️ Knockout Bracket</h4>
                                    <p className="onboarding-points-hint">Per team reaching each round</p>
                                    <div className="onboarding-points-rows">
                                        <div className="onboarding-points-row">
                                            <span className="onboarding-points-label">Round of 16</span>
                                            <span className="onboarding-points-value">2 pts</span>
                                        </div>
                                        <div className="onboarding-points-row">
                                            <span className="onboarding-points-label">Quarter-Finals</span>
                                            <span className="onboarding-points-value">5 pts</span>
                                        </div>
                                        <div className="onboarding-points-row">
                                            <span className="onboarding-points-label">Semi-Finals</span>
                                            <span className="onboarding-points-value">10 pts</span>
                                        </div>
                                        <div className="onboarding-points-row">
                                            <span className="onboarding-points-label">Final</span>
                                            <span className="onboarding-points-value">15 pts</span>
                                        </div>
                                        <div className="onboarding-points-row onboarding-points-row--highlight">
                                            <span className="onboarding-points-label">Champion 🏆</span>
                                            <span className="onboarding-points-value">25 pts</span>
                                        </div>
                                    </div>
                                    <p className="onboarding-points-example">
                                        A champion pick alone earns 2 + 5 + 10 + 15 + 25 = <strong>57 points</strong>
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* ── Step 4: Points — Awards & XI ───────── */}
                        <div className="onboarding-step">
                            <div className="onboarding-step-content">
                                <h3 className="onboarding-section-title">Points — Awards &amp; Best XI</h3>

                                <div className="onboarding-points-card">
                                    <h4 className="onboarding-points-card-title">🏅 Awards</h4>
                                    <div className="onboarding-points-rows">
                                        <div className="onboarding-points-row">
                                            <span className="onboarding-points-label">Major awards (Ball, Boot, Glove)</span>
                                            <span className="onboarding-points-value">10 pts each</span>
                                        </div>
                                        <div className="onboarding-points-row">
                                            <span className="onboarding-points-label">Other awards</span>
                                            <span className="onboarding-points-value">5 pts each</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="onboarding-points-card">
                                    <h4 className="onboarding-points-card-title">👕 Tournament Best XI</h4>
                                    <div className="onboarding-points-rows">
                                        <div className="onboarding-points-row">
                                            <span className="onboarding-points-label">Correct Goalkeeper</span>
                                            <span className="onboarding-points-value">5 pts</span>
                                        </div>
                                        <div className="onboarding-points-row">
                                            <span className="onboarding-points-label">Correct Field Player (any of 10)</span>
                                            <span className="onboarding-points-value">3 pts each</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="onboarding-points-card">
                                    <h4 className="onboarding-points-card-title">💡 How You Score</h4>
                                    <p className="onboarding-leaderboard-text">
                                        Your total combines Group Stage + Knockout + Awards + Best XI points.
                                        The leaderboard updates live as official results come in.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* ── Step 5: Rules & Ready ────────────── */}
                        <div className="onboarding-step">
                            <div className="onboarding-step-content onboarding-step--center">
                                <h3 className="onboarding-section-title">Rules</h3>
                                <p className="onboarding-rules-text" style={{ marginTop: '0.25rem' }}>
                                    ⚠️ Matches lock 1 hour before kickoff. Once locked, predictions cannot be changed.
                                </p>
                                <div className="onboarding-max-score">
                                    🏅 Maximum possible score: ~508 points
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
