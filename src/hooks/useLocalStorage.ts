import { useState, useRef, useCallback } from 'react';

export function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T | ((val: T) => T)) => void] {
    const [storedValue, setStoredValue] = useState<T>(() => {
        if (typeof window === "undefined") {
            return initialValue;
        }
        try {
            const item = window.localStorage.getItem(key);
            return item ? JSON.parse(item) : initialValue;
        } catch {
            return initialValue;
        }
    });

    const stateRef = useRef<T>(storedValue);

    const setValue = useCallback((value: T | ((val: T) => T)) => {
        try {
            const valueToStore = value instanceof Function ? value(stateRef.current) : value;
            stateRef.current = valueToStore;
            setStoredValue(valueToStore);
            if (typeof window !== "undefined") {
                window.localStorage.setItem(key, JSON.stringify(valueToStore));
            }
        } catch {
            /* silent */
        }
    }, [key]);

    return [storedValue, setValue];
}
