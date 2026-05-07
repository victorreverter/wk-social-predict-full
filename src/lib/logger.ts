type LogLevel = 'info' | 'warn' | 'error';

interface LogEntry {
    timestamp: string;
    level: LogLevel;
    message: string;
    details?: unknown;
}

const MAX_BUFFER = 50;
const buffer: LogEntry[] = [];

const serialize = (entry: LogEntry): void => {
    buffer.push(entry);
    if (buffer.length > MAX_BUFFER) buffer.shift();
    if (import.meta.env.DEV) {
        const fn = entry.level === 'error' ? console.error : entry.level === 'warn' ? console.warn : console.log;
        fn(`[${entry.timestamp}] ${entry.message}`, entry.details ?? '');
    }
};

export const logger = {
    info: (message: string, details?: unknown) => {
        serialize({ timestamp: new Date().toISOString(), level: 'info', message, details });
    },
    warn: (message: string, details?: unknown) => {
        serialize({ timestamp: new Date().toISOString(), level: 'warn', message, details });
    },
    error: (message: string, details?: unknown) => {
        serialize({ timestamp: new Date().toISOString(), level: 'error', message, details });
    },
    getBuffer: (): LogEntry[] => [...buffer],
    clear: () => { buffer.length = 0; },
};
