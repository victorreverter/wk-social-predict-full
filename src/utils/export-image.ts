import html2canvas from 'html2canvas';

export const exportBracketToImage = async (elementId: string, filename: string = 'wc2026-prediction.png') => {
    const element = document.getElementById(elementId);

    if (!element) {
        console.error(`Element with id ${elementId} not found`);
        return;
    }

    try {
        const canvas = await html2canvas(element, {
            scale: 2, // High resolution
            useCORS: true,
            backgroundColor: '#0a0a0c', // Match our var(--bg-base) since glassmorphism might need a solid bg behind it
            logging: false,
        });

        // Create a temporary link element to trigger the download
        const link = document.createElement('a');
        link.download = filename;
        link.href = canvas.toDataURL('image/png');
        link.click();

    } catch (err) {
        console.error('Error generating image:', err);
        alert("There was an issue generating the bracket image. Please try again.");
    }
};
