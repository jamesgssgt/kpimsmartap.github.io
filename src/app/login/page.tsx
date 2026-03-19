"use client";

import { useState, useEffect, Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createClient } from "@/utils/supabase/client";
import { useRouter, useSearchParams } from "next/navigation";

function LoginContent() {
    const [site, setSite] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    // View States: 'loading' | 'login' | 'error'
    const [view, setView] = useState<"loading" | "login" | "error">("loading");
    const [errorMessage, setErrorMessage] = useState("");
    const [manualMode, setManualMode] = useState(false); // To prevent auto-redirect loop

    const [isClosed, setIsClosed] = useState(false);

    // Email/Password state
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const router = useRouter();
    const searchParams = useSearchParams();
    const supabase = createClient();

    const handleStandaloneLaunch = () => {
        // Redirect directly to OUR app's SMART launch endpoint to initiate a Provider Standalone Launch.
        // The backend will use SMART_ISS as the FHIR Server URL.
        window.location.href = "/api/auth/smart/launch?standalone=true";
    };

    const handleClose = () => {
        // Aggressive Close Attempt
        // 1. Standard close
        try {
            window.opener = null;
            window.open("", "_self");
            window.close();
        } catch (e) {
            console.log("Standard close failed", e);
        }

        // 2. Fallback: Redirect to about:blank to effectively "kill" the page state
        // This is the closest we can get to closing a main tab in some browsers
        setTimeout(() => {
            if (!document.hidden) { // Check if window is still visible (not closed)
                window.location.href = "about:blank";
            }
        }, 300);

        // 3. Update UI state just in case about:blank is blocked (rare)
        setIsClosed(true);
    };

    useEffect(() => {
        // Clear client-side visibility cookie to ensure UI syncs with session state
        document.cookie = "smart_authenticated=; Max-Age=0; path=/;";

        // Catch stray SMART launch parameters and auto-forward
        const iss = searchParams.get("iss");
        const launch = searchParams.get("launch");
        if (iss && launch) {
            const params = new URLSearchParams();
            params.set("iss", iss);
            params.set("launch", launch);
            window.location.href = `/api/auth/smart/launch?${params.toString()}`;
            return;
        }

        // Check for specific error params from callback
        const errorParam = searchParams.get("error");
        const reasonParam = searchParams.get("reason");

        if (errorParam) {
            setView("error");
            setErrorMessage(errorParam);
            return;
        }

        // If we are in manual mode, do NOT auto-redirect
        if (manualMode) {
            return;
        }

        const defaultAuth = process.env.NEXT_PUBLIC_DEFAULT_AUTH;
        const isLogout = searchParams.get("logout");

        console.log("Debug: NEXT_PUBLIC_DEFAULT_AUTH =", defaultAuth, "IsLogout =", isLogout, "Reason =", reasonParam);

        // Auto-mode: Show loading and redirect
        // Prevent loop if: 1. Logout 2. Reason (Backend rejected launch)
        if (defaultAuth === "1" && !isLogout && !reasonParam) {
            console.log("DefaultAuth=1 detected, auto-redirecting to SMART Launch...");
            setView("loading");
            // If handleStandaloneLaunch is updated to alert, this breaks auto-launch?
            // We should call the URL directly here if we intend to support it, 
            // BUT backend aborts it. So auto-launch effectively becomes "Auto-Fail".
            // So we should NOT auto-launch if backend aborts.
            // If backend is strict, DefaultAuth=1 is invalid config? 
            // Or we just stop the loop.

            // If strict backend, we cannot auto-launch standalone.
            // So we switch to "login" view.
            setView("login");
        } else {
            // Manual mode: Show login form
            setView("login");
        }
    }, [searchParams, manualMode]);

    const handleEmailLogin = async () => {
        if (!email || !password) {
            alert("Please enter both email and password");
            return;
        }

        setIsLoading(true);
        try {
            const { error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (error) {
                console.error("Login error:", error.message);
                alert("Login failed: " + error.message);
            } else {
                router.push("/dashboard");
            }
        } catch (e) {
            console.error("Unexpected error:", e);
            alert("An unexpected error occurred");
        } finally {
            setIsLoading(false);
        }
    };

    if (view === "error") {
        return (
            <div className="min-h-screen flex items-center justify-center bg-muted/20">
                <Card className="w-[400px] border-destructive">
                    <CardHeader>
                        <CardTitle className="text-destructive">驗證失敗</CardTitle>
                        <CardDescription>Authentication Error</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="p-4 bg-destructive/10 text-destructive rounded-md whitespace-pre-wrap break-words text-left">
                            <p className="font-bold">{errorMessage || "Authentication Error"}</p>
                            {searchParams.get("details") && (() => {
                                const details = decodeURIComponent(searchParams.get("details")!);
                                try {
                                    const json = JSON.parse(details);
                                    return (
                                        <div className="mt-2 text-xs opacity-90 overflow-auto max-h-[200px]">
                                            <p className="font-semibold mb-1">Debug Details:</p>
                                            <pre className="p-2 bg-white/50 rounded border border-destructive/20 text-[10px] leading-tight font-mono">
                                                {JSON.stringify(json, null, 2)}
                                            </pre>
                                        </div>
                                    );
                                } catch (e) {
                                    return <p className="text-sm mt-2 opacity-80">{details}</p>;
                                }
                            })()}
                        </div>
                        <Button
                            variant="default"
                            className="w-full"
                            onClick={handleClose}
                        >
                            關閉 (Close)
                        </Button>
                        <Button
                            variant="outline"
                            className="w-full"
                            onClick={() => {
                                setManualMode(true); // Enable manual mode block
                                setView("login");
                                // Clear error params from URL without reload
                                window.history.replaceState({}, "", "/login");
                            }}
                        >
                            改用帳號登入 (Manual Login)
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }


    if (view === "loading" && process.env.NEXT_PUBLIC_DEFAULT_AUTH === "1" && !searchParams.get("logout")) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-muted/20">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
                <h2 className="text-lg font-semibold text-muted-foreground">Redirecting to Authentication...</h2>
                <p className="text-sm text-muted-foreground">正在轉入驗證伺服器...</p>
            </div>
        );
    }

    // Default: Login Form (DefaultAuth=0 or Logout)
    return (
        <div className="min-h-screen flex items-center justify-center bg-muted/20">
            <Card className="w-[400px]">
                <CardHeader>
                    <CardTitle>KPIM Login (v2)</CardTitle>
                    <CardDescription>Sign in to access KPI Dashboard</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label>Hospital Site</Label>
                        <Select value={site} onValueChange={setSite} disabled={isLoading}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select Site" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="gss">叡揚醫院</SelectItem>
                                <SelectItem value="taihe">台合醫院</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="pt-4 space-y-2">
                        <Button
                            variant="outline"
                            className="w-full border-blue-600 text-blue-600 hover:bg-blue-50"
                            onClick={handleStandaloneLaunch}
                            disabled={isLoading}
                        >
                            🚀 Login with SMART ID
                        </Button>

                        <div className="relative">
                            <div className="absolute inset-0 flex items-center">
                                <span className="w-full border-t" />
                            </div>
                            <div className="relative flex justify-center text-xs uppercase">
                                <span className="bg-background px-2 text-muted-foreground">
                                    Or sign in with
                                </span>
                            </div>
                        </div>

                        <Input
                            placeholder="Username (Email)"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            disabled={isLoading}
                        />
                        <Input
                            type="password"
                            placeholder="Password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            disabled={isLoading}
                        />
                        <Button
                            className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                            onClick={handleEmailLogin}
                            disabled={isLoading}
                        >
                            {isLoading ? "Signing in..." : "Sign in"}
                        </Button>
                    </div>

                    <div className="mt-6 pt-4 border-t text-xs text-muted-foreground">
                        <p>Debug Info:</p>
                        <p>Default Auth: {process.env.NEXT_PUBLIC_DEFAULT_AUTH}</p>
                        <p>Environment: {process.env.NODE_ENV}</p>
                    </div>
                </CardContent>
            </Card>
        </div >
    );
}

export default function LoginPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <LoginContent />
        </Suspense>
    );
}
