import { NextRequest, NextResponse } from "next/server";
import { SMART_CONFIG, getSmartMetadata } from "@/utils/smart-conf";
import { cookies } from "next/headers";
import crypto from "node:crypto";

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const iss = searchParams.get("iss") || SMART_CONFIG.iss;
    const launch = searchParams.get("launch");

    // 1. Get Metadata to find authorization_endpoint
    const metadata = await getSmartMetadata(iss);
    const authUrl = metadata?.authorization_endpoint || "https://launch.smarthealthit.org/v/r4/auth/authorize"; // Fallback for sandbox

    // 2. Generate State & PKCE (With valid crypto)
    const state = Math.random().toString(36).substring(7);

    // PKCE: Generate code_verifier and code_challenge
    // Note: Node.js 18+ has global crypto
    const code_verifier = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64url');
    const code_challenge = crypto.createHash('sha256').update(code_verifier).digest('base64url');

    // 3. Construct URL
    const params = new URLSearchParams({
        response_type: "code",
        client_id: SMART_CONFIG.clientId,
        // Use dynamic redirect URI based on the current request origin (supports Vercel Preview/Production)
        redirect_uri: `${request.nextUrl.origin}/api/auth/smart/callback`,
        aud: iss,
        state: state,
        code_challenge: code_challenge,
        code_challenge_method: "S256"
    });

    if (launch) {
        params.append("launch", launch);
    }

    // 4. Store state and iss in cookie for callback verification
    const cookieStore = await cookies();
    cookieStore.set("smart_state", state, { httpOnly: true, secure: process.env.NODE_ENV === "production", path: "/" });
    cookieStore.set("smart_iss", iss, { httpOnly: true, secure: process.env.NODE_ENV === "production", path: "/" });
    cookieStore.set("smart_code_verifier", code_verifier, { httpOnly: true, secure: process.env.NODE_ENV === "production", path: "/" });

    // 5. Redirect
    return NextResponse.redirect(`${authUrl}?${params.toString()}`);
}
