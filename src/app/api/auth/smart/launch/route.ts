import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SMART_CONFIG, getSmartMetadata } from "@/utils/smart-conf";
import crypto from "node:crypto";

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        let iss = searchParams.get("iss") || SMART_CONFIG.iss;
        let launch = searchParams.get("launch");

        // ROBUST FIX: Extract launch param raw processing
        // searchParams can sometimes mishandle '+' -> ' ' conversions depending on exact encoding.
        // We use regex to get the raw substring and decode manually.
        const match = request.url.match(/[?&]launch=([^&]+)/);
        if (match) {
            const raw = match[1];
            try {
                // decodeURIComponent preserves '+' unlike URLSearchParams which might turn it to space if not careful
                launch = decodeURIComponent(raw);
            } catch (e) {
                console.warn("Manual decode of launch param failed, falling back to searchParams", e);
            }
        }

        // FIX: Hijack "hapi.fhir.tw" and redirect to SMART Sandbox
        if (iss && iss.includes("hapi.fhir.tw")) {
            console.warn("Detected hapi.fhir.tw ISS, hijacking to SMART Sandbox for Auth...");
            iss = "https://launch.smarthealthit.org/v/r4/fhir";
            // Do NOT forward launch token if hijacking, as it belongs to the wrong server
            launch = null;
        }

        // 1. Get Metadata to find authorization_endpoint
        const metadata = await getSmartMetadata(iss);
        const authUrl = metadata?.authorization_endpoint || "https://launch.smarthealthit.org/v/r4/auth/authorize";

        // 2. Generate State & PKCE
        const state = Math.random().toString(36).substring(7);
        const code_verifier = crypto.randomBytes(32).toString('base64url');
        const code_challenge = crypto.createHash('sha256').update(code_verifier).digest('base64url');

        // Sanitize launch param (prevent literal "undefined" strings)
        if (launch === "undefined" || launch === "null") {
            launch = null;
        }

        // 3. Construct URL
        const redirectUri = `${request.nextUrl.origin}/api/auth/smart/callback`;
        let scope = SMART_CONFIG.scope;

        if (!launch) {
            // Standalone Mode (No Launch ID):
            // We MUST ensure 'launch' scope is NOT present, as it requires a launch param.
            // We ensure 'launch/patient' IS present to trigger the picker.

            // Sanitizing Scope: Split, Filter, Add, Join
            const scopes = scope.split(" ");
            const newScopes = scopes
                .filter(s => s !== "launch") // Remove raw 'launch'
                .filter(s => s !== "launch/patient"); // Remove existing 'launch/patient' to avoid dupes

            // Add 'launch/patient'
            newScopes.unshift("launch/patient");

            scope = newScopes.join(" ");

            console.log("Converted scope for Standalone Launch:", scope);
        }

        const params = new URLSearchParams({
            response_type: "code",
            client_id: SMART_CONFIG.clientId,
            redirect_uri: redirectUri,
            aud: iss,
            state: state,
            code_challenge: code_challenge,
            code_challenge_method: "S256",
            scope: scope,
        });

        // Append Launch Token manually (re-encoded) to be safe
        let fullAuthUrl = `${authUrl}?${params.toString()}`;
        if (launch) {
            fullAuthUrl += `&launch=${encodeURIComponent(launch)}`;
        }

        console.log("SMART Launch Debug:", {
            requestUrl: request.url,
            iss,
            launch_processed: launch,
            clientId: SMART_CONFIG.clientId,
            redirectUri,
            scope,
            authEndpoint: authUrl,
            fullUrl: fullAuthUrl
        });

        // 4. Store state and iss in cookie for callback verification
        const cookieStore = await cookies();

        // Cookie Options 
        const cookieOptions = {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            path: "/",
            sameSite: "lax" as const,
            maxAge: 1800
        };

        // Set Cookies via Store (Preferred implementation)
        cookieStore.set("smart_state", state, cookieOptions);
        cookieStore.set("smart_iss", iss, cookieOptions);
        cookieStore.set("smart_code_verifier", code_verifier, cookieOptions);

        // 5. Redirect with Cache Busting
        const bustUrl = `${fullAuthUrl}&_t=${Date.now()}`;
        const response = NextResponse.redirect(bustUrl);
        response.headers.set("Cache-Control", "no-store, max-age=0");

        return response;
    } catch (error) {
        console.error("SMART Launch Error:", error);
        return new NextResponse(`SMART Launch Error: ${String(error)}`, { status: 500 });
    }
}
