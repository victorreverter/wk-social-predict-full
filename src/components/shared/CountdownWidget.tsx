import { useState, useEffect } from 'react';
import './CountdownWidget.css';

export const CountdownWidget = () => {
    // 2026-06-11 19:00 UTC corresponds to Match 1 (Mexico vs South Africa)
    const targetDate = new Date("2026-06-11T19:00:00.000Z").getTime();

    const [timeLeft, setTimeLeft] = useState(targetDate - Date.now());

    useEffect(() => {
        const interval = setInterval(() => {
            setTimeLeft(targetDate - Date.now());
        }, 1000);

        return () => clearInterval(interval);
    }, [targetDate]);

    // Disappear completely if countdown reached 0 (match started)
    if (timeLeft <= 0) return null;

    const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
    const hours = Math.floor((timeLeft / (1000 * 60 * 60)) % 24);
    const minutes = Math.floor((timeLeft / 1000 / 60) % 60);
    const seconds = Math.floor((timeLeft / 1000) % 60);

    return (
        <div className="countdown-widget fade-in">
            <span className="countdown-teams">🏆 Tournament Start ⚽</span>
            <div className="countdown-timer">
                <div className="time-block">
                    <span className="time-val">{days}</span>
                    <span className="time-lbl">Days</span>
                </div>
                <span className="time-sep">:</span>
                <div className="time-block">
                    <span className="time-val">{hours.toString().padStart(2, '0')}</span>
                    <span className="time-lbl">Hrs</span>
                </div>
                <span className="time-sep">:</span>
                <div className="time-block">
                    <span className="time-val">{minutes.toString().padStart(2, '0')}</span>
                    <span className="time-lbl">Min</span>
                </div>
                <span className="time-sep">:</span>
                <div className="time-block">
                    <span className="time-val">{seconds.toString().padStart(2, '0')}</span>
                    <span className="time-lbl">Sec</span>
                </div>
            </div>
        </div>
    );
};
