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
        return NextResponse.json({ error: "Auth failed from server", details: error }, { status: 400 });
    }

    const cookieStore = await cookies();
    const storedState = cookieStore.get("smart_state")?.value;

    if (!state || state !== storedState) {
        return NextResponse.json({ error: "Invalid state" }, { status: 400 });
    }

    // Clear state cookie
    // Clear state cookie
    cookieStore.delete("smart_state");

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
        // client_id: SMART_CONFIG.clientId, // If using Basic Auth, id is in header usually, but some require both
    });

    const headers: HeadersInit = {
        "Content-Type": "application/x-www-form-urlencoded",
    };

    if (SMART_CONFIG.authType === "asymmetric") {
        // Asymmetric Authentication (Private Key JWT)
        if (!SMART_CONFIG.privateKey) {
            return NextResponse.json({ error: "Configuration Error", details: "Missing privateKey for asymmetric auth" }, { status: 500 });
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
            return NextResponse.json({ error: "Key Signing Error", details: String(error) }, { status: 500 });
        }

    } else {
        // Symmetric Client Authentication
        // Using Basic Auth as it's standard for Confidential Clients
        const authString = Buffer.from(`${SMART_CONFIG.clientId}:${SMART_CONFIG.clientSecret}`).toString('base64');
        headers["Authorization"] = `Basic ${authString}`;
    }

    try {
        const res = await fetch(tokenUrl, {
            method: "POST",
            headers,
            body,
        });

        const tokenResponse = await res.json();

        if (!res.ok) {
            return NextResponse.json({ error: "Token exchange failed", details: tokenResponse }, { status: 400 });
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
        return NextResponse.json({ error: "Token Request Error", details: String(e) }, { status: 500 });
    }
}
