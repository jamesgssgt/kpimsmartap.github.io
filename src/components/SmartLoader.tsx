"use client";

import React, { useEffect, useState } from "react";
// Imports removed
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

export default function SmartLoader({ children }: { children: React.ReactNode }) {

    const [error, setError] = useState<Error | null>(null);
    const [isSupabaseAuthenticated, setIsSupabaseAuthenticated] = useState(false);
    const router = useRouter();

    useEffect(() => {
        const checkSession = async () => {
            const supabase = createClient();
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
                setIsSupabaseAuthenticated(true);
            } else {
                // Determine if we need to redirect or if we are waiting for a server-side auth cookie.
                // Since this is a hybrid app, if we have no Supabase session, we prompt login.
                // The DashboardLayout wraps everything, so we must be authenticated.
                router.push("/login");
            }
        };
        checkSession();
    }, [router]);

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen text-destructive">
                <h2 className="text-xl font-bold">Authorization Failed</h2>
                <p>{error.message}</p>
                <button onClick={() => router.push("/login")} className="mt-4 underline">
                    Back to Login
                </button>
            </div>
        );
    }

    if (!isSupabaseAuthenticated) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                <span className="ml-2 text-muted-foreground">Verifying Session...</span>
            </div>
        );
    }

    // Provide client to children via context or props if needed.
    // For now just render, assuming children might use useSmart specific hook or just pure props.
    // Ideally, we should wrap this in a Context Provider here if we want to share the client instance.

    return <>{children}</>;
}
