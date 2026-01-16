import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SMART_CONFIG, getSmartMetadata } from "@/utils/smart-conf";
import crypto from "node:crypto";

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        let iss = searchParams.get("iss") || SMART_CONFIG.iss;
        let launch = searchParams.get("launch");

        // [CRITICAL FIX] Strict Launch Requirement (No Standalone via this route)
        // SMART Health IT Sandbox expects EHR-initiated launch (with token).
        // App-initiated standalone launch (without token) is not supported here and causes crashes.

        // 1. Check for missing launch (Strict)
        // Catches: null, undefined, literal "undefined"/"null" strings, empty strings
        if (!launch || launch === "undefined" || launch === "null" || !launch.trim()) {
            console.warn("SMART Launch called without launch param. Abort.");
            return NextResponse.redirect(new URL("/login?reason=smart_launch_required", request.url));
        }

        // 2. Check for truncated/invalid launch (Length Defense)
        // Relaxed limit from 50 to 5 to allow UUIDs (36 chars) from SMART Sandbox
        if (launch.length < 5) {
            console.warn(`SMART Launch called with invalid/short launch token (${launch.length} chars). Abort.`);
            return NextResponse.redirect(new URL("/login?reason=smart_launch_truncated", request.url));
        }

        // PATCH: Fix "+" becoming space in searchParams
        if (launch.includes(" ")) {
            console.log("Restoring '+' in launch token (received as space)");
            launch = launch.replace(/ /g, "+");
        }

        // FIX: Reject hapi.fhir.tw strictly
        if (iss && iss.includes("hapi.fhir.tw")) {
            console.warn("Detected hapi.fhir.tw ISS, which does not support SMART Launch. Aborting.");
            return NextResponse.redirect(new URL("/login?error=invalid_iss_hapi_not_supported", request.url));
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
        const scope = SMART_CONFIG.scope;

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
