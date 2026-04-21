import { useState, useEffect, useCallback } from "react";

export type ModelDefaults = {
    writing: string;
    imageGeneration: string;
    utility: string;
};

const STORAGE_KEY = "brand-studio:model-defaults";

const FACTORY_DEFAULTS: ModelDefaults = {
    writing: "gpt-5.4",
    imageGeneration: "gpt-image-2",
    utility: "gpt-4.1-mini",
};

function loadDefaults(): ModelDefaults {
    if (typeof window === "undefined") return { ...FACTORY_DEFAULTS };
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            return {
                writing: parsed.writing ?? FACTORY_DEFAULTS.writing,
                imageGeneration: parsed.imageGeneration ?? FACTORY_DEFAULTS.imageGeneration,
                utility: parsed.utility ?? FACTORY_DEFAULTS.utility,
            };
        }
    } catch {}
    return { ...FACTORY_DEFAULTS };
}

function saveDefaults(defaults: ModelDefaults) {
    if (typeof window === "undefined") return;
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(defaults));
    } catch {}
}

/**
 * Hook that manages per-process default model selections,
 * persisted in localStorage.
 */
export function useModelDefaults() {
    const [defaults, setDefaultsState] = useState<ModelDefaults>(FACTORY_DEFAULTS);
    const [loaded, setLoaded] = useState(false);

    // Hydrate from localStorage on mount (avoids SSR mismatch)
    useEffect(() => {
        setDefaultsState(loadDefaults());
        setLoaded(true);
    }, []);

    const setDefault = useCallback(
        (key: keyof ModelDefaults, value: string) => {
            setDefaultsState((prev) => {
                const next = { ...prev, [key]: value };
                saveDefaults(next);
                return next;
            });
        },
        []
    );

    const resetDefaults = useCallback(() => {
        const fresh = { ...FACTORY_DEFAULTS };
        setDefaultsState(fresh);
        saveDefaults(fresh);
    }, []);

    return { defaults, setDefault, resetDefaults, loaded, FACTORY_DEFAULTS };
}
