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

        // FIX: Hijack "hapi.fhir.tw" and redirect to SMART Sandbox
        // The user is likely selecting hapi.fhir.tw in the launcher, but that server doesn't support SMART Auth.
        // We force it to the Sandbox to allow the login flow to complete.
        if (iss && iss.includes("hapi.fhir.tw")) {
            console.warn("Detected hapi.fhir.tw ISS, hijacking to SMART Sandbox for Auth...");
            iss = "https://launch.smarthealthit.org/v/r4/fhir";

            // CRITICAL FIX: The 'launch' context from keys is bound to hapi.fhir.tw.
            // We cannot use it on the Sandbox. We must drop it to force a Standalone Launch.
            launch = null;
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

        // Scope Logic:
        // If 'launch' param is present -> EHR Launch -> use 'launch' scope
        // If 'launch' param is MISSING -> Standalone Launch -> use 'launch/patient' scope
        // This prevents "Unexpected end of JSON input" error when requesting 'launch' scope without a launch id.
        let scope = SMART_CONFIG.scope;
        if (!launch) {
            scope = scope.replace("launch", "launch/patient");
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

        if (launch) {
            params.append("launch", launch);
        }

        const fullAuthUrl = `${authUrl}?${params.toString()}`;
        console.log("SMART Launch Debug:", {
            iss,
            launch,
            clientId: SMART_CONFIG.clientId,
            redirectUri,
            scope: SMART_CONFIG.scope,
            authEndpoint: authUrl,
            fullUrl: fullAuthUrl
        });

        // 4. Store state and iss in cookie for callback verification
        const cookieStore = await cookies();
        const cookieOptions = {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            path: "/",
            sameSite: "lax" as const,
            maxAge: 600 // 10 minutes
        };

        cookieStore.set("smart_state", state, cookieOptions);
        cookieStore.set("smart_iss", iss, cookieOptions);
        cookieStore.set("smart_code_verifier", code_verifier, cookieOptions);

        if (debug === "true") {
            return new NextResponse(`
                <html>
                    <head>
                        <title>SMART Launch Debug</title>
                        <style>
                            body { font-family: sans-serif; padding: 20px; max-width: 800px; margin: 0 auto; line-height: 1.6; }
                            h1 { color: #cc0000; }
                            pre { background: #f4f4f4; padding: 15px; border-radius: 5px; overflow-x: auto; }
                            .btn { display: inline-block; padding: 10px 20px; background: #007bff; color: white; text-decoration: none; border-radius: 5px; margin-top: 20px; }
                            .btn:hover { background: #0056b3; }
                        </style>
                    </head>
                    <body>
                        <h1>SMART Launch Debug Mode</h1>
                        <p><strong>ISS:</strong> ${iss}</p>
                        <p><strong>Launch ID:</strong> ${launch}</p>
                        <p><strong>Client ID:</strong> ${SMART_CONFIG.clientId}</p>
                        <p><strong>Redirect URI:</strong> ${redirectUri}</p>
                        <p><strong>Scope:</strong> ${SMART_CONFIG.scope}</p>
                        <p><strong>Auth Endpoint:</strong> ${authUrl}</p>
                        
                        <h3>Generated Authorization URL</h3>
                        <pre>${fullAuthUrl}</pre>

                        <a href="${fullAuthUrl}" class="btn">Proceed to Connect</a>
                    </body>
                </html>
            `, { headers: { "Content-Type": "text/html" } });
        }

        // 5. Redirect
        return NextResponse.redirect(fullAuthUrl);
    } catch (error) {
        console.error("SMART Launch Error:", error);
        return new NextResponse(`SMART Launch Error: ${String(error)}`, { status: 500 });
    }
}
