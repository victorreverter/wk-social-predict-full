import html2canvas from 'html2canvas';
import type { Match } from '../types';

export const exportBracketToImage = async (
    _matchesList: Match[],
    filename: string = 'wc2026-prediction.jpg'
) => {
    try {
        const wrapperElement = document.getElementById('bracket-export-target');
        const scrollContainer = wrapperElement?.querySelector('.bracket-scroll-container') as HTMLElement;

        if (!wrapperElement || !scrollContainer) throw new Error('Bracket element not found');

        // 1. Measure the full uncropped width before touching anything
        const fullWidth = scrollContainer.scrollWidth;
        const fullHeight = scrollContainer.scrollHeight;

        // Temporarily expand overflow so html2canvas doesn't clip hidden content
        const originalOverflow = scrollContainer.style.overflow;
        const originalMaxWidth = wrapperElement.style.maxWidth;

        scrollContainer.style.overflow = 'visible';
        wrapperElement.style.maxWidth = 'none';

        // Prevent out-of-memory crashes on iOS
        const isMobile = window.innerWidth <= 768;
        const exportScale = isMobile ? 1.5 : 2;

        const canvas = await html2canvas(wrapperElement, {
            scale: exportScale,
            useCORS: true,
            allowTaint: true,
            backgroundColor: '#0a0a0c',
            logging: false,
            // Simulate a wide viewport so "width: 100%" resolves to the full bracket width.
            // This avoids flex-column gaps caused by physically overriding DOM width.
            windowWidth: fullWidth,
            windowHeight: fullHeight,
        });

        // Restore styles
        scrollContainer.style.overflow = originalOverflow;
        wrapperElement.style.maxWidth = originalMaxWidth;

        const dataUrl = canvas.toDataURL('image/jpeg', 0.95);

        const link = document.createElement('a');
        link.download = filename;
        link.href = dataUrl;
        link.click();
    } catch (err) {
        console.error('Error generating image:', err);
        alert("There was an issue generating the bracket image.");
    }
};
