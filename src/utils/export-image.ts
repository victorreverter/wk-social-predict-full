import html2canvas from 'html2canvas';
import type { Match } from '../types';

/**
 * Draws an SVG (by URL) onto an offscreen canvas and returns a PNG data URL.
 * Forces the browser's own SVG renderer to rasterize the flag first,
 * completely bypassing html2canvas's broken SVG support on mobile.
 */
function svgToPng(svgUrl: string, w: number, h: number): Promise<string> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            const cvs = document.createElement('canvas');
            cvs.width = w * 3;   // 3× for sharpness
            cvs.height = h * 3;
            const ctx = cvs.getContext('2d');
            if (!ctx) return reject(new Error('No 2d context'));
            ctx.drawImage(img, 0, 0, cvs.width, cvs.height);
            resolve(cvs.toDataURL('image/png'));
        };
        img.onerror = () => reject(new Error(`Failed to load ${svgUrl}`));
        img.src = svgUrl;
    });
}

/**
 * On MOBILE only: replaces every .team-flag <img> with a pre-rasterized PNG.
 * Returns a function that restores all original srcs after the canvas is captured.
 */
async function rasterizeSvgFlags(container: HTMLElement): Promise<() => void> {
    const imgs = Array.from(
        container.querySelectorAll<HTMLImageElement>('img.team-flag')
    );
    const restoreMap: Array<{ img: HTMLImageElement; original: string }> = [];

    await Promise.all(
        imgs.map(async (img) => {
            try {
                const png = await svgToPng(
                    img.src,
                    img.naturalWidth || 24,
                    img.naturalHeight || 16
                );
                restoreMap.push({ img, original: img.src });
                img.src = png;
            } catch {
                // Leave as-is if anything fails — better partial than crash
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

        // Measure the full uncropped width before touching anything
        const fullWidth = scrollContainer.scrollWidth;
        const fullHeight = scrollContainer.scrollHeight;

        const originalOverflow = scrollContainer.style.overflow;
        const originalMaxWidth = wrapperElement.style.maxWidth;

        scrollContainer.style.overflow = 'visible';
        wrapperElement.style.maxWidth = 'none';

        const isMobile = window.innerWidth <= 768;
        const exportScale = isMobile ? 1.5 : 2;

        // On mobile: pre-rasterize all SVG flags to PNG so html2canvas renders them properly
        const restoreSvgs = isMobile
            ? await rasterizeSvgFlags(wrapperElement)
            : () => { };

        const canvas = await html2canvas(wrapperElement, {
            scale: exportScale,
            useCORS: true,
            allowTaint: true,
            backgroundColor: '#0a0a0c',
            logging: false,
            // Simulate a wide viewport so "width: 100%" resolves to the full bracket width
            windowWidth: fullWidth,
            windowHeight: fullHeight,
        });

        // Restore everything
        restoreSvgs();
        scrollContainer.style.overflow = originalOverflow;
        wrapperElement.style.maxWidth = originalMaxWidth;

        // Mobile: use Web Share API (link.click() is blocked in async context on iOS/Android)
        // Desktop: direct download via anchor click
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
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.download = filename;
            link.href = url;
            link.click();
            URL.revokeObjectURL(url);
        }
    } catch (err) {
        console.error('Error generating image:', err);
        alert('There was an issue generating the bracket image.');
    }
};
