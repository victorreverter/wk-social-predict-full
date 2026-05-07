const BACKOFF_BASE = 300;

export const withRetry = async <T>(
    fn: () => Promise<T>,
    retries = 2,
    delay = BACKOFF_BASE,
): Promise<T> => {
    let lastErr: unknown;
    for (let i = 0; i <= retries; i++) {
        try {
            return await fn();
        } catch (err) {
            lastErr = err;
            if (i < retries) {
                await new Promise(r => setTimeout(r, delay * 2 ** i));
            }
        }
    }
    throw lastErr;
};
