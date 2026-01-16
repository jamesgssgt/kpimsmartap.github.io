import { NextRequest, NextResponse } from "next/server";
import { SMART_CONFIG, getSmartMetadata } from "@/utils/smart-conf";
import { cookies } from "next/headers";
import { SignJWT, importPKCS8 } from "jose";

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");
    const errorDescription = searchParams.get("error_description");

    if (error) {
        const debugInfo = JSON.stringify({
            error,
            description: errorDescription || "No description provided by Auth Server"
        });
        return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(error)}&details=${encodeURIComponent(debugInfo)}`, request.url));
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
        // Fix: Use Standard Public Client Auth (Body Only)
        // No Authorization header. client_id in body.
        // We explicitly ensure client_id is in the body below.
        if (!body.has("client_id")) {
            body.append("client_id", SMART_CONFIG.clientId);
        }
    }

    try {
        console.log("Exchanging code for token...", {
            tokenUrl,
            clientId: SMART_CONFIG.clientId,
            hasAuthHeader: !!headers["Authorization"],
            bodyParams: Array.from(body.keys()) // Log keys to check presence
        });

        const res = await fetch(tokenUrl, {
            method: "POST",
            headers: {
                ...headers,
                "Accept": "application/json"
            },
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
        // Proceed to identity extraction and cookie setting.

        // Plan B logic for identity fetching remains above...
        // Extract Identity (id_token OR Fetch Patient)
        let identity = {
            sub: tokenResponse.patient || "unknown",
            iss: iss,
            name: "Guest User",
            email: ""
        };

        // Plan A: Try id_token
        if (tokenResponse.id_token) {
            try {
                const { decodeJwt } = await import("jose");
                const claims = decodeJwt(tokenResponse.id_token);
                console.log("SMART Callback: id_token claims:", claims);

                if (claims.sub) identity.sub = claims.sub as string;
                if (claims.email) identity.email = claims.email as string;

                const claimName = claims.name || claims.profile || claims.fhirUser;
                if (claimName) {
                    identity.name = claimName as string;
                }
            } catch (e) {
                console.warn("Failed to decode id_token:", e);
            }
        }

        // Plan B: If still "Guest User" and we have a Patient ID, FETCH the Patient Name
        if (identity.name === "Guest User" && tokenResponse.patient && iss) {
            try {
                console.log(`Fetching Patient Name for ${tokenResponse.patient}...`);
                const patRes = await fetch(`${iss}/Patient/${tokenResponse.patient}`, {
                    headers: { "Authorization": `Bearer ${tokenResponse.access_token}` }
                });

                if (patRes.ok) {
                    const patData = await patRes.json();
                    // FHIR HumanName helper
                    const getName = (pt: any) => {
                        if (!pt?.name || pt.name.length === 0) return null;
                        const n = pt.name[0];
                        if (n.text) return n.text;
                        const family = n.family || "";
                        const given = n.given ? n.given.join(" ") : "";
                        return `${family} ${given}`.trim();
                    }
                    const fetchedName = getName(patData);
                    if (fetchedName) {
                        identity.name = fetchedName;
                        console.log("Fetched Patient Name:", identity.name);
                    }
                } else {
                    console.warn(`Failed to fetch Patient details: ${patRes.status} ${patRes.statusText}`);
                }
            } catch (fetchErr) {
                console.error("Failed to fetch Patient details:", fetchErr);
            }
        }

        // Plan C: If still "Guest User" and sub is a Practitioner, FETCH Practitioner Name
        if (identity.name === "Guest User" && identity.sub && identity.sub.startsWith("Practitioner/") && iss) {
            try {
                console.log(`Fetching Practitioner Name for ${identity.sub}...`);
                const pracRes = await fetch(`${iss}/${identity.sub}`, {
                    headers: { "Authorization": `Bearer ${tokenResponse.access_token}` }
                });

                if (pracRes.ok) {
                    const pracData = await pracRes.json();
                    const getName = (pt: any) => {
                        if (!pt?.name || pt.name.length === 0) return null;
                        const n = pt.name[0];
                        if (n.text) return n.text;
                        const family = n.family || "";
                        const given = n.given ? n.given.join(" ") : "";
                        return `${family} ${given}`.trim();
                    }
                    const fetchedName = getName(pracData);
                    if (fetchedName) {
                        identity.name = fetchedName;
                        console.log("Fetched Practitioner Name:", identity.name);
                    }
                }
            } catch (e) {
                console.warn("Failed to fetch Practitioner:", e);
            }
        }

        // 5. Store Tokens & Session -> Set on the RESPONSE object
        // Create Redirect Response first
        const redirectUrl = new URL("/dashboard", request.url);
        const response = NextResponse.redirect(redirectUrl);

        console.log("Setting Auth Cookies...", {
            accessToken: tokenResponse.access_token ? "Yes" : "No",
            patient: tokenResponse.patient,
            identity: identity.name
        });

        const oneHour = 3600;
        response.cookies.set("fhir_access_token", tokenResponse.access_token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            path: "/",
            sameSite: "lax",
            maxAge: oneHour,
        });

        if (tokenResponse.refresh_token) {
            response.cookies.set("fhir_refresh_token", tokenResponse.refresh_token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                path: "/",
                sameSite: "lax",
                maxAge: oneHour * 24, // 1 day
            });
        }

        if (tokenResponse.patient) {
            response.cookies.set("fhir_patient", tokenResponse.patient, {
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                path: "/",
                sameSite: "lax"
            });
        }

        response.cookies.set("fhir_user_identity", JSON.stringify(identity), {
            httpOnly: false, // Allow client to read for display
            secure: process.env.NODE_ENV === "production",
            path: "/",
            sameSite: "lax"
        });

        // Set a visible cookie for client-side to assume we are authenticated via SMART
        response.cookies.set("smart_authenticated", "1", {
            httpOnly: false, // Accessible by JS
            secure: process.env.NODE_ENV === "production",
            path: "/",
            sameSite: "lax"
        });

        return response;

    } catch (e) {
        console.error("Callback Error:", e);
        return NextResponse.redirect(new URL(`/login?error=token_request_error&details=${encodeURIComponent(String(e))}`, request.url));
    }
}
