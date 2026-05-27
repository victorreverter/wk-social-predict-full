import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import './TutorialOverlay.css';

const TUTORIAL_STORAGE_KEY = 'hasSeenTutorial_v1';

const STEPS = [
    {
        selector: '[data-tutorial-id="tutorial-group-positions"]',
        title: 'Start Here \u2014 Positions',
        text: 'Drag teams to predict 1st\u20134th in all 12 groups \u2014 must be done BEFORE kickoff. Click this tab to continue.',
    },
    {
        selector: '[data-tutorial-id="tutorial-bracket"]',
        title: 'Complete Your Bracket',
        text: 'After positions, pick 8 third-placers and fill the knockout bracket \u2014 also before kickoff.',
    },
    {
        selector: '[data-tutorial-id="tutorial-games"]',
        title: 'Bonus Points \u2014 Games',
        text: 'During the tournament, predict match scores day by day for extra bonus points.',
    },
    {
        selector: '[data-tutorial-id="tutorial-save"]',
        title: 'Save Anytime',
        text: 'Tap the floating save button to persist your predictions. It lives on every page.',
    },
    {
        selector: '[data-tutorial-id="tutorial-help"]',
        title: 'Need More Help?',
        text: 'For the full guide, tap the ? button in the header anytime. Ready to predict?',
    },
];

const findVisibleTarget = (selector: string): Element | null => {
    const els = document.querySelectorAll(selector);
    for (let i = 0; i < els.length; i++) {
        const rect = els[i].getBoundingClientRect();
        if (rect.width > 2 && rect.height > 2) return els[i];
    }
    return null;
};

const getSpotlightStyle = (el: Element) => {
    const r = el.getBoundingClientRect();
    const pad = 8;
    return {
        left: r.left - pad,
        top: r.top - pad,
        width: r.width + pad * 2,
        height: r.height + pad * 2,
    };
};

const getTooltipStyle = (spotRect: ReturnType<typeof getSpotlightStyle>): {
    top: number;
    left: number;
    className: string;
} => {
    const gap = 16;
    const w = Math.min(280, window.innerWidth - 32);
    const h = 210;
    const narrow = window.innerWidth < 768;

    if (narrow) {
        const top = spotRect.top + spotRect.height + gap;
        const left = Math.max(gap, Math.min(spotRect.left + spotRect.width / 2 - w / 2, window.innerWidth - w - gap));
        const fits = top + h <= window.innerHeight - gap;
        return {
            top: fits ? top : spotRect.top - h - gap,
            left,
            className: 'tutorial-tooltip--arrow-bottom',
        };
    }

    const r = spotRect;
    const rRight = r.left + r.width;
    const rBottom = r.top + r.height;
    const canFitRight = rRight + gap + w <= window.innerWidth;
    const canFitLeft = r.left - gap - w >= 0;

    if (canFitRight) {
        return {
            top: Math.max(gap, Math.min(r.top + r.height / 2 - h / 2, window.innerHeight - h - gap)),
            left: rRight + gap,
            className: 'tutorial-tooltip--arrow-left',
        };
    }
    if (canFitLeft) {
        return {
            top: Math.max(gap, Math.min(r.top + r.height / 2 - h / 2, window.innerHeight - h - gap)),
            left: r.left - gap - w,
            className: 'tutorial-tooltip--arrow-right',
        };
    }
    return {
        top: rBottom + gap,
        left: Math.max(gap, Math.min(r.left + r.width / 2 - w / 2, window.innerWidth - w - gap)),
        className: 'tutorial-tooltip--arrow-bottom',
    };
};

export const TutorialOverlay: React.FC = () => {
    const { setActiveTab } = useApp();
    const [step, setStep] = useState(0);
    const [targetEl, setTargetEl] = useState<Element | null>(null);
    const [spotlight, setSpotlight] = useState<ReturnType<typeof getSpotlightStyle> | null>(null);
    const [tooltip, setTooltip] = useState<ReturnType<typeof getTooltipStyle> | null>(null);
    const [visible, setVisible] = useState(false);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const locate = (stepIdx: number) => {
        const el = findVisibleTarget(STEPS[stepIdx].selector);
        if (el) {
            setTargetEl(el);
            const s = getSpotlightStyle(el);
            setSpotlight(s);
            setTooltip(getTooltipStyle(s));
            return true;
        }
        return false;
    };

    const finish = () => {
        localStorage.setItem(TUTORIAL_STORAGE_KEY, 'true');
        setVisible(false);
        setActiveTab('GAMES');
        window.dispatchEvent(new Event('tutorial-complete'));
    };

    const advance = () => {
        if (step < STEPS.length - 1) {
            const next = step + 1;
            setStep(next);
            setTargetEl(null);
            setSpotlight(null);
            setTooltip(null);
        } else {
            finish();
        }
    };

    useEffect(() => {
        const hasSeen = localStorage.getItem(TUTORIAL_STORAGE_KEY) === 'true';
        if (hasSeen) return;

        timerRef.current = setTimeout(() => {
            setVisible(true);
            const attempt = () => {
                if (locate(0)) return;
                timerRef.current = setTimeout(attempt, 250);
            };
            attempt();
        }, 500);

        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, []);

    useEffect(() => {
        if (!visible) return;
        const attempt = () => {
            if (locate(step)) return;
            timerRef.current = setTimeout(attempt, 200);
        };
        attempt();
        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, [step, visible]);

    useEffect(() => {
        if (!targetEl) return;
        const handler = () => advance();
        targetEl.addEventListener('click', handler);
        return () => targetEl.removeEventListener('click', handler);
    }, [targetEl, step]);

    useEffect(() => {
        if (!visible) return;
        const onResize = () => {
            const el = findVisibleTarget(STEPS[step].selector);
            if (el) {
                const s = getSpotlightStyle(el);
                setSpotlight(s);
                setTooltip(getTooltipStyle(s));
            }
        };
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') finish();
            if (e.key === 'ArrowRight' || e.key === 'Enter') advance();
        };
        window.addEventListener('resize', onResize);
        window.addEventListener('keydown', onKey);
        return () => {
            window.removeEventListener('resize', onResize);
            window.removeEventListener('keydown', onKey);
        };
    }, [visible, step]);

    if (!visible) return null;

    const isLast = step === STEPS.length - 1;
    const stepData = STEPS[step];
    const hasTarget = spotlight !== null && tooltip !== null;

    return (
        <div className="tutorial-overlay">
            {hasTarget && (
                <div
                    className="tutorial-spotlight"
                    style={{
                        left: spotlight.left,
                        top: spotlight.top,
                        width: spotlight.width,
                        height: spotlight.height,
                    }}
                />
            )}

            <div
                className={`tutorial-tooltip ${hasTarget ? tooltip.className : 'tutorial-tooltip--center'}`}
                style={
                    hasTarget
                        ? { top: tooltip.top, left: tooltip.left }
                        : { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }
                }
                onClick={e => e.stopPropagation()}
            >
                <div className="tutorial-tooltip-step">{step + 1} / {STEPS.length}</div>
                <h3 className="tutorial-tooltip-title">{stepData.title}</h3>
                <p className="tutorial-tooltip-text">{stepData.text}</p>
                <div className="tutorial-tooltip-actions">
                    <button className="tutorial-skip-btn" onClick={finish}>Skip</button>
                    <button className="tutorial-next-btn" onClick={advance}>
                        {isLast ? 'Got it!' : 'Next'}
                    </button>
                </div>
            </div>
        </div>
    );
};
