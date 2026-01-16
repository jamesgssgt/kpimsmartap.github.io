"use client";

import { useEffect } from "react";
import { oauth2 as SMART } from "fhirclient";

export default function LaunchPage() {
    useEffect(() => {
        SMART.authorize({
            clientId: "my-client-id", // Replace with logic or env
            scope: "launch launch/patient patient/read openid fhirUser",
            redirectUri: "/dashboard", // Redirect to dashboard after auth
            iss: "https://launch.smarthealthit.org/v/r4/fhir", // Fallback or dynamic
        }).catch((e) => {
            console.error(e);
            alert("Error in SMART Launch: " + e.message);
        });
    }, []);

    return (
        <div className="flex min-h-screen items-center justify-center bg-background">
            <div className="text-center">
                <h1 className="text-2xl font-bold mb-4">Connecting to EHR...</h1>
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            </div>
        </div>
    );
}
