"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

interface SettingsContextType {
    enableAi: boolean;
    setEnableAi: (value: boolean) => void;
    enableFavorites: boolean;
    setEnableFavorites: (value: boolean) => void;
}

const SettingsContext = createContext<SettingsContextType>({
    enableAi: true,
    setEnableAi: () => { },
    enableFavorites: false, // 預設關閉
    setEnableFavorites: () => { },
});

export const useSettings = () => useContext(SettingsContext);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [enableAi, setEnableAi] = useState(true);
    const [enableFavorites, setEnableFavorites] = useState(false);
    const [loaded, setLoaded] = useState(false);

    useEffect(() => {
        const storedAi = localStorage.getItem("KPIM_ENABLE_AI");
        if (storedAi !== null) {
            setEnableAi(storedAi === "true");
        }
        
        const storedFav = localStorage.getItem("KPIM_ENABLE_FAVORITES");
        if (storedFav !== null) {
            setEnableFavorites(storedFav === "true");
        }
        setLoaded(true);
    }, []);

    const updateAiSetting = (value: boolean) => {
        setEnableAi(value);
        localStorage.setItem("KPIM_ENABLE_AI", String(value));
    };

    const updateFavoritesSetting = (value: boolean) => {
        setEnableFavorites(value);
        localStorage.setItem("KPIM_ENABLE_FAVORITES", String(value));
    };

    return (
        <SettingsContext.Provider value={{
            enableAi,
            setEnableAi: updateAiSetting,
            enableFavorites,
            setEnableFavorites: updateFavoritesSetting
        }}>
            {children}
        </SettingsContext.Provider>
    );
};
