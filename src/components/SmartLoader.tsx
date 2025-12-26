"use client";

import React, { useEffect, useState } from "react";
// Imports removed
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

import { getCookie } from "@/utils/cookie";

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
                // Check for DefaultAuth=1 (OAuth2/SMART)
                const defaultAuth = process.env.NEXT_PUBLIC_DEFAULT_AUTH;
                const smartAuthCookie = await getCookie("smart_authenticated");

                if (defaultAuth === "1" && smartAuthCookie === "1") {
                    console.log("SMART Auth detected, signing in anonymously to Supabase...");
                    const { error: anonError } = await supabase.auth.signInAnonymously();
                    if (!anonError) {
                        setIsSupabaseAuthenticated(true);
                        return;
                    } else {
                        console.error("Anonymous login failed:", anonError);
                        // Fall through to redirect
                    }
                }

                // Normal flow: Redirect to login
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
