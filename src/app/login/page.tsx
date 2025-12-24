"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";

export default function LoginPage() {
    const [site, setSite] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    // Email/Password state
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const router = useRouter();
    const supabase = createClient();

    const handleStandaloneLaunch = () => {
        setIsLoading(true);
        window.location.href = "/api/auth/smart/launch";
    };

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
                        <Button
                            className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                            onClick={handleStandaloneLaunch}
                            disabled={isLoading}
                        >
                            {isLoading ? "Redirecting..." : "Login with Smart ID"}
                        </Button>
                        <div className="relative">
                            <div className="absolute inset-0 flex items-center">
                                <span className="w-full border-t" />
                            </div>
                            <div className="relative flex justify-center text-xs uppercase">
                                <span className="bg-background px-2 text-muted-foreground">輸入帳號/密碼登入</span>
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
                            variant="outline"
                            className="w-full"
                            onClick={handleEmailLogin}
                            disabled={isLoading}
                        >
                            {isLoading ? "Signing in..." : "Sign in with Email"}
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
