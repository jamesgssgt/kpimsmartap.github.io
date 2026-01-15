import { NextRequest, NextResponse } from "next/server";
import { SMART_CONFIG, getSmartMetadata } from "@/utils/smart-conf";
import { cookies } from "next/headers";
import { SignJWT, importPKCS8 } from "jose";

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");

    if (error) {
        return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(error)}&details=auth_failed`, request.url));
    }

    const cookieStore = await cookies();
    const storedState = cookieStore.get("smart_state")?.value;

    if (!state || state !== storedState) {
        const debugInfo = JSON.stringify({
            error: "State Mismatch",
            received_state: state,
            stored_state: storedState ? storedState.substring(0, 5) + "..." : "null"
        });
        return NextResponse.redirect(new URL(`/login?error=invalid_state&details=${encodeURIComponent(debugInfo)}`, request.url));
    }

    // Clear state cookie
    cookieStore.delete("smart_state");

    // PKCE: Get code_verifier
    const codeVerifier = cookieStore.get("smart_code_verifier")?.value;
    cookieStore.delete("smart_code_verifier");

    // Exchange Code
    const storedIss = cookieStore.get("smart_iss")?.value;
    const iss = storedIss || SMART_CONFIG.iss;
    const metadata = await getSmartMetadata(iss);
    const tokenUrl = metadata?.token_endpoint || "https://launch.smarthealthit.org/v/r4/auth/token";

    // Confidential Client Authentication (Symmetric)
    // We send Authorization header Basic ... or client_secret in body
    // SMART usually supports client_secret in body or header. 
    // For Asymmetric, we would sign a JWT and send client_assertion.
    // For this demo satisfying "Confidential", we'll use Basic Auth or body secret.

    const body = new URLSearchParams({
        grant_type: "authorization_code",
        code: code!,
        // Use dynamic redirect URI to match the one sent in the launch request
        redirect_uri: `${request.nextUrl.origin}/api/auth/smart/callback`,
        client_id: SMART_CONFIG.clientId,
    });

    if (codeVerifier) {
        body.append("code_verifier", codeVerifier);
    }

    const headers: HeadersInit = {
        "Content-Type": "application/x-www-form-urlencoded",
    };

    if (SMART_CONFIG.authType === "asymmetric") {
        // Asymmetric Authentication (Private Key JWT)
        if (!SMART_CONFIG.privateKey) {
            return NextResponse.redirect(new URL("/login?error=config_error&details=missing_private_key", request.url));
        }

        try {
            // Import private key
            const privateKey = await importPKCS8(SMART_CONFIG.privateKey, SMART_CONFIG.signingAlg);

            // Generate Client Assertion
            const jwt = await new SignJWT({})
                .setProtectedHeader({ alg: SMART_CONFIG.signingAlg, kid: SMART_CONFIG.keyId, typ: "JWT" })
                .setIssuer(SMART_CONFIG.clientId)
                .setSubject(SMART_CONFIG.clientId)
                .setAudience(tokenUrl)
                .setJti(crypto.randomUUID())
                .setIssuedAt()
                .setExpirationTime("5m")
                .sign(privateKey);

            body.append("client_assertion_type", "urn:ietf:params:oauth:client-assertion-type:jwt-bearer");
            body.append("client_assertion", jwt);

        } catch (error) {
            return NextResponse.redirect(new URL(`/login?error=signing_error&details=${encodeURIComponent(String(error))}`, request.url));
        }

    } else {
        // Symmetric Client Authentication for Confidential Clients
        // valid secret check: ensure it's not the default dummy value
        if (SMART_CONFIG.clientSecret && SMART_CONFIG.clientSecret !== "my-client-secret") {
            const authString = Buffer.from(`${SMART_CONFIG.clientId}:${SMART_CONFIG.clientSecret}`).toString('base64');
            headers["Authorization"] = `Basic ${authString}`;
        }
        // If it IS "my-client-secret", we assume Public Client (PKCE only) and send no Secret.
    }

    try {
        console.log("Exchanging code for token...", { tokenUrl, clientId: SMART_CONFIG.clientId, hasSecret: !!headers["Authorization"] });

        const res = await fetch(tokenUrl, {
            method: "POST",
            headers,
            body,
        });

        const tokenText = await res.text();
        let tokenResponse;
        try {
            tokenResponse = JSON.parse(tokenText);
        } catch (e) {
            tokenResponse = { raw: tokenText };
        }

        console.log("Token Response:", res.status, res.ok ? "OK" : tokenText);

        if (!res.ok) {
            const debugInfo = JSON.stringify({
                status: res.status,
                statusText: res.statusText,
                response: tokenResponse
            }, null, 2);
            return NextResponse.redirect(new URL(`/login?error=token_exchange_failed&details=${encodeURIComponent(debugInfo)}`, request.url));
        }

        // Success! We have the token.
        // In a real app, store this in an encrypted HTTP-Only session cookie.
        // For now, setting a simple cookie for the dashboard to know we are "connected".
        // ideally, Supabase session should be primary. This is "linked" FHIR session.

        // We'll store the access token in a strict cookie
        cookieStore.set("fhir_access_token", tokenResponse.access_token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            path: "/",
            maxAge: tokenResponse.expires_in || 3600
        });

        if (tokenResponse.patient) {
            cookieStore.set("fhir_patient", tokenResponse.patient, {
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                path: "/"
            });
        }

        // Set a visible cookie for client-side to assume we are authenticated via SMART
        // This allows SmartLoader to trigger anonymous login if needed
        cookieStore.set("smart_authenticated", "1", {
            httpOnly: false, // Accessible by JS
            secure: process.env.NODE_ENV === "production",
            path: "/"
        });

        return NextResponse.redirect(new URL("/dashboard", request.url));

    } catch (e) {
        return NextResponse.redirect(new URL(`/login?error=token_request_error&details=${encodeURIComponent(String(e))}`, request.url));
    }
}
