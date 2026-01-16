import { NextRequest, NextResponse } from "next/server";
import { SMART_CONFIG, getSmartMetadata } from "@/utils/smart-conf";
import crypto from "node:crypto";

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        let iss = searchParams.get("iss") || SMART_CONFIG.iss;
        let launch = searchParams.get("launch");
        const debug = searchParams.get("debug");

        // FIX: Hijack "hapi.fhir.tw" and redirect to SMART Sandbox
        if (iss && iss.includes("hapi.fhir.tw")) {
            console.warn("Detected hapi.fhir.tw ISS, hijacking to SMART Sandbox for Auth...");
            iss = "https://launch.smarthealthit.org/v/r4/fhir";
            // Do NOT forward launch token if hijacking, as it belongs to the wrong server
            launch = null;
        }

        // FAIL-SAFE: Handle "+" decoding issue in Launch Token
        // When reading from searchParams, "+" is decoded as " " (space).
        // Launch tokens (Base64) often contain "+" but never " ".
        // If we see spaces, we assume they were originally "+" and restore them.
        if (launch && launch.includes(" ")) {
            console.log("Restoring '+' in launch token (received as space)");
            launch = launch.replace(/ /g, "+");
        }

        // 1. Get Metadata to find authorization_endpoint
        const metadata = await getSmartMetadata(iss);
        const authUrl = metadata?.authorization_endpoint || "https://launch.smarthealthit.org/v/r4/auth/authorize";

        // 2. Generate State & PKCE
        const state = Math.random().toString(36).substring(7);
        const code_verifier = crypto.randomBytes(32).toString('base64url');
        const code_challenge = crypto.createHash('sha256').update(code_verifier).digest('base64url');

        // 3. Construct URL
        const redirectUri = `${request.nextUrl.origin}/api/auth/smart/callback`;
        let scope = SMART_CONFIG.scope;

        if (!launch) {
            // Standalone Mode (No Launch ID): Ask for patient picker
            if (scope.includes("launch") && !scope.includes("launch/patient")) {
                scope = scope.replace("launch", "launch/patient");
            }
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
