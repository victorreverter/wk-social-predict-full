import { describe, it, expect } from 'vitest';

describe('Leaderboard pagination', () => {
    it('shows correct page slice', () => {
        const items = Array.from({ length: 20 }, (_, i) => ({
            id: `${i}`,
            username: `user${i}`,
            display_name: null,
            avatar_url: null,
            matches_pts: i,
            ko_pts: 0,
            awa_pts: 0,
            xi_pts: 0,
            total: i,
        }));
        const pageSize = 15;
        const page = 0;
        const slice = items.slice(page * pageSize, (page + 1) * pageSize);
        expect(slice.length).toBe(15);
    });

    it('detects last page correctly', () => {
        const total = 32;
        const pageSize = 15;
        const maxPage = Math.ceil(total / pageSize) - 1;
        expect(maxPage).toBe(2);
    });
});

describe('Player name sanitization', () => {
    it('strips angle brackets', () => {
        const sanitize = (s: string) => s.replace(/[<>{}]/g, '').slice(0, 30);
        expect(sanitize('<script>alert("xss")</script>')).toBe('scriptalert("xss")/script');
    });

    it('truncates to 30 chars', () => {
        const sanitize = (s: string) => s.replace(/[<>{}]/g, '').slice(0, 30);
        const long = 'a'.repeat(50);
        expect(sanitize(long)).toBe('a'.repeat(30));
    });

    it('preserves valid names', () => {
        const sanitize = (s: string) => s.replace(/[<>{}]/g, '').slice(0, 30);
        expect(sanitize('Cristiano Ronaldo')).toBe('Cristiano Ronaldo');
    });
});

describe('Logger buffer', () => {
    it('caps at MAX_BUFFER', () => {
        const buf: string[] = [];
        const MAX = 5;
        for (let i = 0; i < 10; i++) {
            buf.push(`entry-${i}`);
            if (buf.length > MAX) buf.shift();
        }
        expect(buf.length).toBe(5);
        expect(buf[0]).toBe('entry-5');
    });
});
