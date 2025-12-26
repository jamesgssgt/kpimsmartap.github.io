import { NextRequest, NextResponse } from "next/server";
import { SMART_CONFIG, getSmartMetadata } from "@/utils/smart-conf";
import { cookies } from "next/headers";

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const iss = searchParams.get("iss") || SMART_CONFIG.iss;
    const launch = searchParams.get("launch");

    // 1. Get Metadata to find authorization_endpoint
    const metadata = await getSmartMetadata(iss);
    const authUrl = metadata?.authorization_endpoint || "https://launch.smarthealthit.org/v/r4/auth/authorize"; // Fallback for sandbox

    // 2. Generate State & PKCE (Simplified for now, using random state)
    const state = Math.random().toString(36).substring(7);

    // 3. Construct URL
    const params = new URLSearchParams({
        response_type: "code",
        client_id: SMART_CONFIG.clientId,
        // Use dynamic redirect URI based on the current request origin (supports Vercel Preview/Production)
        redirect_uri: `${request.nextUrl.origin}/api/auth/smart/callback`,
        aud: iss,
        state: state,
    });

    if (launch) {
        params.append("launch", launch);
    }

    // 4. Store state and iss in cookie for callback verification
    const cookieStore = await cookies();
    cookieStore.set("smart_state", state, { httpOnly: true, secure: process.env.NODE_ENV === "production", path: "/" });
    cookieStore.set("smart_iss", iss, { httpOnly: true, secure: process.env.NODE_ENV === "production", path: "/" });

    // 5. Redirect
    return NextResponse.redirect(`${authUrl}?${params.toString()}`);
}
