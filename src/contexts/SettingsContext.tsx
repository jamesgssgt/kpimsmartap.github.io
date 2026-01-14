"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

interface SettingsContextType {
    enableAi: boolean;
    setEnableAi: (value: boolean) => void;
}

const SettingsContext = createContext<SettingsContextType>({
    enableAi: true,
    setEnableAi: () => { },
});

export const useSettings = () => useContext(SettingsContext);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [enableAi, setEnableAi] = useState(true);
    const [loaded, setLoaded] = useState(false);

    useEffect(() => {
        const stored = localStorage.getItem("KPIM_ENABLE_AI");
        if (stored !== null) {
            setEnableAi(stored === "true");
        }
        setLoaded(true);
    }, []);

    const updateAiSetting = (value: boolean) => {
        setEnableAi(value);
        localStorage.setItem("KPIM_ENABLE_AI", String(value));
    };

    // Avoid hydration mismatch or flickering by waiting for load (optional, but good for consistent UI)
    // For now, we render children even if loading, default is true.

    return (
        <SettingsContext.Provider value={{ enableAi, setEnableAi: updateAiSetting }}>
            {children}
        </SettingsContext.Provider>
    );
};
