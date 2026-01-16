"use client";

import { useEffect, useState, Suspense } from "react";
import { oauth2 as SMART } from "fhirclient";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Bug, Play, ExternalLink, ArrowRight } from "lucide-react";
import Link from "next/link";

function LaunchPageContent() {
    const searchParams = useSearchParams();
    const [status, setStatus] = useState<"idle" | "launching" | "error">("idle");
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [debugInfo, setDebugInfo] = useState<any>({});

    const iss = searchParams.get("iss");
    const launch = searchParams.get("launch");

    useEffect(() => {
        setDebugInfo({
            iss,
            launch,
            matchesHapiTw: iss?.includes("hapi.fhir.tw"),
            timestamp: new Date().toISOString(),
            fullUrl: window.location.href
        });
    }, [iss, launch]);

    const handleLaunch = () => {
        setStatus("launching");
        setErrorMsg(null);

        SMART.authorize({
            clientId: "my-postop-app",
            scope: "launch launch/patient patient/read openid fhirUser",
            redirectUri: "/app/api/auth/smart/callback", // Use absolute path if needed or ensure relative path is correct
            iss: iss || "https://hapi.fhir.tw/fhir",
        }).catch((e) => {
            console.error(e);
            setStatus("error");
            setErrorMsg(e.message);
        });
    };

    // Auto-launch if parameters look correct, or wait for user? 
    // User requested "What is being passed", so let's pause by default or provide a clear view.
    // For now, let's auto-launch ONLY if we are sure, but maybe it's better to show the debug info first if requested.
    // However, standard flow is auto-redirect. Let's add a "Auto Launch" toggle or just show info during the process.
    // Given the user is debugging, I will make it manual for now or show detailed state.

    // Let's try to launch immediately but keep the UI informative if it fails or if it's slow.
    // Actually, to answer "what is passed", we should pause or just log it.
    // But usually you want it to work. Let's provide a visible "Debug Mode" toggle or just render the data.

    // Changing strategy: Render the parameters clearly. If 'launch' is present, we try to authorize.
    // But the user said "Why it failed originally". 
    // I will add a 3-second delay or just show the info while "Connecting..."

    useEffect(() => {
        if (iss || launch) {
            // Optional: Uncomment to auto-launch
            // handleLaunch();
        }
    }, [iss, launch]);

    return (
        <div className="container mx-auto flex min-h-screen flex-col items-center justify-center p-4">
            <Card className="w-full max-w-lg mb-8">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Bug className="h-5 w-5" />
                        SMART Launch Debugger
                    </CardTitle>
                    <CardDescription>
                        Inspect parameters received from the EHR / Launcher
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="bg-slate-950 text-slate-50 p-4 rounded-lg overflow-auto text-xs font-mono">
                        <h3 className="uppercase text-muted-foreground font-bold mb-2">Received Parameters</h3>
                        <div className="grid grid-cols-[80px_1fr] gap-2">
                            <span className="text-blue-400">iss:</span>
                            <span className="break-all">{iss || "<missing>"}</span>

                            <span className="text-blue-400">launch:</span>
                            <span className="break-all">{launch || "<missing>"}</span>
                        </div>
                    </div>

                    {errorMsg && (
                        <div className="p-3 bg-red-100 text-red-700 rounded text-sm border border-red-200">
                            <strong>Launch Error:</strong> {errorMsg}
                        </div>
                    )}

                    <div className="flex flex-col gap-3 pt-4">
                        <Button
                            onClick={handleLaunch}
                            disabled={status === "launching"}
                            className="w-full"
                            size="lg"
                        >
                            {status === "launching" ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Authorizing...
                                </>
                            ) : (
                                <>
                                    <Play className="mr-2 h-4 w-4" />
                                    Proceed with Launch
                                </>
                            )}
                        </Button>

                        {iss && (
                            <Link href={`/check?iss=${encodeURIComponent(iss)}`} target="_blank">
                                <Button variant="outline" className="w-full">
                                    <ExternalLink className="mr-2 h-4 w-4" />
                                    Check Server Metadata
                                </Button>
                            </Link>
                        )}
                        <Link href={`/dashboard`} >
                            <Button variant="ghost" className="w-full text-muted-foreground">
                                Skip to Dashboard (Stand-alone)
                            </Button>
                        </Link>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

export default function LaunchPage() {
    return (
        <Suspense fallback={<div className="flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>}>
            <LaunchPageContent />
        </Suspense>
    );
}
