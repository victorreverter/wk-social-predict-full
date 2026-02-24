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

        // Temporarily adjust styling to capture the full overflowing bracket correctly
        const originalOverflow = scrollContainer.style.overflow;
        const originalMaxWidth = wrapperElement.style.maxWidth;

        scrollContainer.style.overflow = 'visible';
        wrapperElement.style.maxWidth = 'none';

        const canvas = await html2canvas(wrapperElement, {
            scale: 2, // High resolution
            useCORS: true,
            allowTaint: true,
            backgroundColor: '#0a0a0c', // Ensure the background bleeds correctly
            logging: false,
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
