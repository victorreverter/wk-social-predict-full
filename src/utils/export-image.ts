import type { Match, Team } from '../types';
import { initialTeams } from './data-init';

export const exportBracketToImage = async (
    matchesList: Match[],
    filename: string = 'wc2026-prediction.jpg'
) => {
    try {
        // Create a native canvas (invisible)
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Could not get 2D context');

        // Bracket Canvas Dimensions
        canvas.width = 1600;
        canvas.height = 1000;

        // Background
        ctx.fillStyle = '#0a0a0c';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Styling Config
        const boxWidth = 160;
        const boxHeight = 50;
        const roundSpacing = 220; // X distance between rounds
        const colors = {
            border: '#2a2a35',
            text: '#ffffff',
            badge: '#6366f1',
            homeBg: '#1a1a24',
            awayBg: '#13131a',
        };

        // Helper to draw a match node
        const drawMatch = (match: Match, x: number, y: number) => {
            const home = initialTeams.find(t => t.id === match.homeTeamId);
            const away = initialTeams.find(t => t.id === match.awayTeamId);

            ctx.lineWidth = 1;
            ctx.strokeStyle = colors.border;
            ctx.fillStyle = colors.homeBg;

            // Main Box
            ctx.fillRect(x, y, boxWidth, boxHeight);
            ctx.strokeRect(x, y, boxWidth, boxHeight);

            // Divider
            ctx.beginPath();
            ctx.moveTo(x, y + boxHeight / 2);
            ctx.lineTo(x + boxWidth, y + boxHeight / 2);
            ctx.stroke();

            // Text Setup
            ctx.fillStyle = colors.text;
            ctx.font = '12px Inter, sans-serif';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';

            // Home Team Text
            ctx.fillText(home ? home.name : 'TBD', x + 10, y + boxHeight / 4);
            // Away Team Text
            ctx.fillText(away ? away.name : 'TBD', x + 10, y + (boxHeight / 4) * 3);

            // Scores (if hard mode / finished)
            if (match.score.homeGoals !== null) {
                ctx.textAlign = 'right';
                ctx.fillText(match.score.homeGoals.toString(), x + boxWidth - 10, y + boxHeight / 4);
                ctx.fillText(match.score.awayGoals!.toString(), x + boxWidth - 10, y + (boxHeight / 4) * 3);
            }

            // Match ID Badge
            ctx.fillStyle = colors.badge;
            ctx.fillRect(x, y - 14, 40, 14);
            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'center';
            ctx.font = '10px Inter, sans-serif';
            ctx.fillText(match.id.replace('k_', ''), x + 20, y - 7);
        };

        // Logic to layout the bracket (simplified center-out approach)
        // Left Side layout
        const leftR32 = matchesList.filter(m => m.stage === 'R32').slice(0, 8);
        const leftR16 = matchesList.filter(m => m.stage === 'R16').slice(0, 4);
        const leftQF = matchesList.filter(m => m.stage === 'QF').slice(0, 2);
        const leftSF = matchesList.filter(m => m.stage === 'SF').slice(0, 1);

        // Right Side layout
        const rightR32 = matchesList.filter(m => m.stage === 'R32').slice(8);
        const rightR16 = matchesList.filter(m => m.stage === 'R16').slice(4);
        const rightQF = matchesList.filter(m => m.stage === 'QF').slice(2);
        const rightSF = matchesList.filter(m => m.stage === 'SF').slice(1);

        const finalMatch = matchesList.find(m => m.stage === 'F');

        // Draw Left Bracket
        leftR32.forEach((m, i) => drawMatch(m, 50, 50 + i * 110));
        leftR16.forEach((m, i) => drawMatch(m, 50 + roundSpacing, 105 + i * 220));
        leftQF.forEach((m, i) => drawMatch(m, 50 + roundSpacing * 2, 215 + i * 440));
        leftSF.forEach((m, i) => drawMatch(m, 50 + roundSpacing * 3, 435));

        // Draw Right Bracket
        rightR32.forEach((m, i) => drawMatch(m, canvas.width - boxWidth - 50, 50 + i * 110));
        rightR16.forEach((m, i) => drawMatch(m, canvas.width - boxWidth - 50 - roundSpacing, 105 + i * 220));
        rightQF.forEach((m, i) => drawMatch(m, canvas.width - boxWidth - 50 - roundSpacing * 2, 215 + i * 440));
        rightSF.forEach((m, i) => drawMatch(m, canvas.width - boxWidth - 50 - roundSpacing * 3, 435));

        // Draw Final
        if (finalMatch) {
            drawMatch(finalMatch, canvas.width / 2 - boxWidth / 2, 600);

            ctx.fillStyle = '#10b981';
            ctx.font = 'bold 24px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('FINAL', canvas.width / 2, 570);
        }

        // Title
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 36px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('My 2026 World Cup Bracket Prediction', canvas.width / 2, 60);

        // Convert to JPG
        const dataUrl = canvas.toDataURL('image/jpeg', 0.95);

        // Create a temporary link element to trigger the download
        const link = document.createElement('a');
        link.download = filename;
        link.href = dataUrl;
        link.click();

    } catch (err) {
        console.error('Error generating image:', err);
        alert("There was an issue generating the bracket image.");
    }
};
