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
        setIsLoading(true);
        window.location.href = "/api/auth/smart/launch";
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
        // Check for specific error params from callback
        const errorParam = searchParams.get("error");
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
        console.log("Debug: NEXT_PUBLIC_DEFAULT_AUTH =", defaultAuth);

        if (defaultAuth === "1") {
            // Auto-mode: Show loading and redirect
            console.log("DefaultAuth=1 detected, auto-redirecting to SMART Launch...");
            setView("loading");
            handleStandaloneLaunch();
        } else {
            // Manual mode: Show login form
            setView("login");
        }
    }, [searchParams, manualMode]);

    // ... (in Error View render) ...
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
                    </CardContent >
                </Card >
            </div >
        );
}

if (view === "loading" && process.env.NEXT_PUBLIC_DEFAULT_AUTH === "1") {
    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-muted/20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
            <h2 className="text-lg font-semibold text-muted-foreground">Redirecting to Authentication...</h2>
            <p className="text-sm text-muted-foreground">正在轉入驗證伺服器...</p>
        </div>
    );
}

// Default: Login Form (DefaultAuth=0)
// Note: Removed "Login with Smart ID" button as requested for manual mode cleanup
return (
    <div className="min-h-screen flex items-center justify-center bg-muted/20">
        <Card className="w-[400px]">
            <CardHeader>
                <CardTitle>KPIM Login</CardTitle>
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
                    {/* Smart Login Button REMOVED as per request for cleanup */}

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
