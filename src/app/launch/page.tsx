"use client";

import { useEffect } from "react";
import { Loader2 } from "lucide-react";

export default function LaunchPage() {
    useEffect(() => {
        // Redirect to the Server-side Launch Route
        // capable of handling cookies, PKCE, and hapi.fhir.tw hijacking logic
        const query = window.location.search;
        window.location.href = `/api/auth/smart/launch${query}`;
    }, []);

    return (
        <div className="flex min-h-screen items-center justify-center bg-background">
            <div className="flex flex-col items-center gap-4">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <h1 className="text-xl font-medium">Initializing Secure Session...</h1>
                <p className="text-sm text-muted-foreground">Redirecting to Authorization Server</p>
            </div>
        </div>
    );
}
