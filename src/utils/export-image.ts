import html2canvas from 'html2canvas';
import type { Match } from '../types';

/**
 * html2canvas cannot render <img src="*.svg"> on mobile browsers — they appear as coloured
 * rectangles. This helper fetches every SVG flag inside a container, encodes it as a
 * base64 data URL, swaps the src, and returns a function that restores the originals.
 */
async function inlineSvgImages(container: HTMLElement): Promise<() => void> {
    const imgs = Array.from(container.querySelectorAll<HTMLImageElement>('img[src]')).filter(
        (img) => img.src.endsWith('.svg') || img.src.includes('.svg?')
    );

    const restoreMap: Array<{ img: HTMLImageElement; original: string }> = [];

    await Promise.all(
        imgs.map(async (img) => {
            try {
                const res = await fetch(img.src);
                const text = await res.text();
                const b64 = btoa(unescape(encodeURIComponent(text)));
                const dataUrl = `data:image/svg+xml;base64,${b64}`;
                restoreMap.push({ img, original: img.src });
                img.src = dataUrl;
            } catch {
                // If fetch fails, leave the src as-is
            }
        })
    );

    return () => restoreMap.forEach(({ img, original }) => { img.src = original; });
}

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

        // 2. Pre-convert all SVG flags to base64 so html2canvas renders them correctly on mobile
        const restoreSvgs = await inlineSvgImages(wrapperElement);

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

        // 3. Restore SVG srcs and layout styles
        restoreSvgs();
        scrollContainer.style.overflow = originalOverflow;
        wrapperElement.style.maxWidth = originalMaxWidth;

        // Mobile browsers block async link.click() downloads (gesture context expires).
        // Use the Web Share API on mobile to open the native OS share/save sheet.
        const blob = await new Promise<Blob>((resolve, reject) =>
            canvas.toBlob((b) => b ? resolve(b) : reject(new Error('Canvas toBlob failed')), 'image/jpeg', 0.95)
        );

        const file = new File([blob], filename, { type: 'image/jpeg' });
        if (isMobile && navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({
                files: [file],
                title: 'My WC 2026 Bracket',
            });
        } else {
            // Desktop fallback: direct download via anchor click
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.download = filename;
            link.href = url;
            link.click();
            URL.revokeObjectURL(url);
        }
    } catch (err) {
        console.error('Error generating image:', err);
        alert("There was an issue generating the bracket image.");
    }
};
