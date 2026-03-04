import { useState, useEffect } from 'react';
import './OnboardingModal.css';

export const OnboardingModal: React.FC = () => {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        // Check local storage to see if the user has already seen the onboarding
        const hasSeenOnboarding = localStorage.getItem('hasSeenOnboarding');
        if (!hasSeenOnboarding) {
            setIsVisible(true);
        }
    }, []);

    const handleDismiss = () => {
        localStorage.setItem('hasSeenOnboarding', 'true');
        setIsVisible(false);
    };

    if (!isVisible) return null;

    return (
        <div className="onboarding-overlay">
            <div className="onboarding-modal glass-panel">
                <h2 className="onboarding-title text-gradient">Welcome to WC 2026 Predictor!</h2>

                <div className="onboarding-content">
                    <p className="onboarding-intro">
                        Predict the entire path to glory for the 2026 World Cup. Here's how it works:
                    </p>

                    <ul className="onboarding-steps">
                        <li>
                            <span className="step-icon">🏆</span>
                            <div className="step-text">
                                <strong>Group Stage:</strong> Predict match outcomes. Use <em>Easy Mode</em> to just pick winners, or <em>Hard Mode</em> to predict exact scores!
                            </div>
                        </li>
                        <li>
                            <span className="step-icon">⚡</span>
                            <div className="step-text">
                                <strong>Auto-Fill:</strong> Short on time? Use the Auto-Fill button to randomly simulate the entire group stage.
                            </div>
                        </li>
                        <li>
                            <span className="step-icon">🥉</span>
                            <div className="step-text">
                                <strong>Third Place Selection:</strong> After groups, select the 8 best third-placed teams to advance to the knockouts.
                            </div>
                        </li>
                        <li>
                            <span className="step-icon">⚔️</span>
                            <div className="step-text">
                                <strong>Knockout Bracket:</strong> Progress teams through the bracket all the way to the final to crown your champion!
                            </div>
                        </li>
                    </ul>
                </div>

                <button className="onboarding-button" onClick={handleDismiss}>
                    Let's Predict!
                </button>
            </div>
        </div>
    );
};
