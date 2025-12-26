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
        // Strictly attempt to close the window as requested
        try {
            window.opener = null;
            window.open("", "_self");
            window.close();
        } catch (e) {
            console.log("Could not close window:", e);
        }
    };

    useEffect(() => {
        // Check for specific error params from callback
        const errorParam = searchParams.get("error");
        if (errorParam) {
            setView("error");
            setErrorMessage("找不到驗證伺服器或帳號錯誤");
            return;
        }

        const defaultAuth = process.env.NEXT_PUBLIC_DEFAULT_AUTH;

        if (defaultAuth === "1") {
            // Auto-mode: Show loading and redirect
            console.log("DefaultAuth=1 detected, auto-redirecting to SMART Launch...");
            setView("loading");
            handleStandaloneLaunch();
        } else {
            // Manual mode: Show login form
            setView("login");
        }
    }, [searchParams]);

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

    // Render Views
    if (view === "error") {
        return (
            <div className="min-h-screen flex items-center justify-center bg-muted/20">
                <Card className="w-[400px] border-destructive">
                    <CardHeader>
                        <CardTitle className="text-destructive">驗證失敗</CardTitle>
                        <CardDescription>Authentication Error</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="p-4 bg-destructive/10 text-destructive rounded-md">
                            {errorMessage || "找不到驗證伺服器或帳號錯誤"}
                        </div>
                        <Button
                            variant="default"
                            className="w-full"
                            onClick={handleClose}
                        >
                            關閉 (Close)
                        </Button>
                    </CardContent>
                </Card>
            </div>
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
                </CardContent>
            </Card>
        </div>
    );
}

export default function LoginPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <LoginContent />
        </Suspense>
    );
}
