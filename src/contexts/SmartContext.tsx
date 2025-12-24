"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import Client from "fhirclient/lib/Client";
import { oauth2 as SMART } from "fhirclient";

interface SmartContextType {
    client: Client | null;
    patient: any | null;
    user: any | null;
    error: Error | null;
    isLoading: boolean;
}

const SmartContext = createContext<SmartContextType>({
    client: null,
    patient: null,
    user: null,
    error: null,
    isLoading: true,
});

export const useSmart = () => useContext(SmartContext);

export function SmartProvider({ children }: { children: React.ReactNode }) {
    const [client, setClient] = useState<Client | null>(null);
    const [patient, setPatient] = useState<any | null>(null);
    const [user, setUser] = useState<any | null>(null);
    const [error, setError] = useState<Error | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // Check if we are in a redirect context (code param exists) or just need database
        // This part is tricky in Next.js App Router 
        // Usually we call SMART.ready() on the redirect page.
        // If this provider wraps the dashboard, we expect client to be ready.

        // For now, we will expose state. The actual ready() call might happen in a page component
        // or we try to re-hydrate here if session storage persists.
        setIsLoading(false);
    }, []);

    return (
        <SmartContext.Provider value={{ client, patient, user, error, isLoading }}>
            {children}
        </SmartContext.Provider>
    );
}
