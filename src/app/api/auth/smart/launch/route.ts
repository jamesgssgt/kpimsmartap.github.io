import { NextRequest, NextResponse } from "next/server";
import { SMART_CONFIG, getSmartMetadata } from "@/utils/smart-conf";
import { cookies } from "next/headers";
import crypto from "node:crypto";

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        let iss = searchParams.get("iss") || SMART_CONFIG.iss; // Changed to let to allow modification
        let launch = searchParams.get("launch"); // Changed to let
        const debug = searchParams.get("debug");



        // Use Regex to extract launch param RAW to avoid auto-decoding corruption
        const rawLaunchMatch = request.url.match(/[?&]launch=([^&]+)/);
        let rawLaunch = rawLaunchMatch ? rawLaunchMatch[1] : null;

        // FAIL-SAFE: Check for Token Content Integrity
        // The error "Unexpected end of JSON input" from the auth server means the JSON inside the Base64 token is broken.
        if (rawLaunch) {
            try {
                // Try to decode as Base64 to see if it's a JSON object
                // Note: Launch tokens can be opaque, but if they are Base64 JSON, we must ensure they are valid.
                // We use decodeURIComponent first in case it's URL encoded, then fallback to raw
                const candidate = decodeURIComponent(rawLaunch);
                const decoded = Buffer.from(candidate, 'base64').toString('utf-8');

                // Heuristic: If it looks like JSON (starts with { or [), it MUST be valid JSON.
                // SMART Sandbox Launch tokens can be JSON Arrays or Objects.
                const trimmed = decoded.trim();
                if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
                    try {
                        JSON.parse(decoded);
                        // If parse succeeds, it's valid.
                    } catch (jsonError) {
                        console.warn("CRITICAL: Launch Token is Broken JSON (Truncated?). Dropping to prevent Auth Server crash.", jsonError);
                        rawLaunch = null;
                    }
                }
            } catch (e) {
                // Not valid base64 or other issue? 
                // If it wasn't valid base64, maybe it's just an ID. checking JSON validity is skiped.
            }
        }

        // FIX: Hijack "hapi.fhir.tw" and redirect to SMART Sandbox
        if (iss && iss.includes("hapi.fhir.tw")) {
            console.warn("Detected hapi.fhir.tw ISS, hijacking to SMART Sandbox for Auth...");
            iss = "https://launch.smarthealthit.org/v/r4/fhir";
            launch = null;
            rawLaunch = null;
        }

        // 1. Get Metadata to find authorization_endpoint
        const metadata = await getSmartMetadata(iss);
        const authUrl = metadata?.authorization_endpoint || "https://launch.smarthealthit.org/v/r4/auth/authorize"; // Fallback for sandbox

        // 2. Generate State & PKCE (With valid crypto)
        const state = Math.random().toString(36).substring(7);

        // PKCE: Generate code_verifier and code_challenge
        // Fix: Use crypto.randomBytes for Node.js environment instead of Web Crypto's getRandomValues on the module
        const code_verifier = crypto.randomBytes(32).toString('base64url');
        const code_challenge = crypto.createHash('sha256').update(code_verifier).digest('base64url');

        // 3. Construct URL
        const redirectUri = `${request.nextUrl.origin}/api/auth/smart/callback`;

        let scope = SMART_CONFIG.scope;

        if (!rawLaunch) {
            // Standalone Mode (No Launch ID):
            // Ensure we ask for 'launch/patient' to trigger the picker.
            if (scope.includes("launch") && !scope.includes("launch/patient")) {
                scope = scope.replace("launch", "launch/patient");
            }
        } else {
            // EHR Mode (With Launch ID):
            // Keep generic 'launch' scope.
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

        // Append RAW launch if it exists
        // We manually append the raw string to avoid any re-encoding/decoding by URLSearchParams
        let fullAuthUrl = `${authUrl}?${params.toString()}`;
        if (rawLaunch) {
            fullAuthUrl += `&launch=${rawLaunch}`;
        }


        console.log("SMART Launch Debug:", {
            requestUrl: request.url, // CRITICAL: See exact incoming URL
            iss,
            launch, // Decoded via searchParams
            rawLaunch, // Extracted via Regex
            clientId: SMART_CONFIG.clientId,
            redirectUri,
            scope: SMART_CONFIG.scope,
            authEndpoint: authUrl,
            fullUrl: fullAuthUrl
        });

        // 4. Store state and iss in cookie for callback verification
        // 4. Store state and iss in cookie for callback verification
        // const cookieStore = await cookies(); // Not using this for setting anymore

        // Cookie Options 
        const cookieOptions = {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            path: "/",
            sameSite: "lax" as const,
            maxAge: 1800
        };

        // 5. Redirect with Cache Busting
        const bustUrl = `${fullAuthUrl}&_t=${Date.now()}`;
        const response = NextResponse.redirect(bustUrl);
        response.headers.set("Cache-Control", "no-store, max-age=0");

        // Set Cookies on Response
        response.cookies.set("smart_state", state, cookieOptions);
        response.cookies.set("smart_iss", iss, cookieOptions);
        response.cookies.set("smart_code_verifier", code_verifier, cookieOptions);

        return response;
    } catch (error) {
        console.error("SMART Launch Error:", error);
        return new NextResponse(`SMART Launch Error: ${String(error)}`, { status: 500 });
    }
}
