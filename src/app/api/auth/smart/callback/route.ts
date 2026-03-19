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
        // Include client_secret for confidential clients
        if (SMART_CONFIG.clientSecret) {
            body.append("client_secret", SMART_CONFIG.clientSecret);
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
        // Extract Identity (id_token OR Fetch Patient/Practitioner)
        let primarySub = tokenResponse.patient || tokenResponse.practitioner || tokenResponse.user;
        let identity: any = {
            sub: primarySub || "unknown",
            iss: iss,
            name: "", // Default to empty so we know if it's missing
            email: "",
            debug_log: [] as string[]
        };

        identity.debug_log.push(`Initial sub: ${identity.sub}`);

        // Plan A: Try id_token
        if (tokenResponse.id_token) {
            try {
                const { decodeJwt } = await import("jose");
                const claims = decodeJwt(tokenResponse.id_token);

                if (claims.sub && !primarySub) identity.sub = claims.sub as string;
                if (claims.email) identity.email = claims.email as string;

                // FIX: Resolve Opaque ID using fhirUser claim (Standard SMART way)
                if (claims.fhirUser && typeof claims.fhirUser === "string") {
                    const parts = claims.fhirUser.split("/");
                    if (parts.length >= 2) {
                        const id = parts[parts.length - 1];
                        const type = parts[parts.length - 2];
                        identity.sub = `${type}/${id}`;
                        identity.debug_log.push(`Resolved fhirUser: ${identity.sub}`);
                    }
                } else if (claims.profile && typeof claims.profile === "string" && claims.profile.includes("/")) {
                    const parts = claims.profile.split("/");
                    if (parts.length >= 2) {
                        const id = parts[parts.length - 1];
                        const type = parts[parts.length - 2];
                        identity.sub = `${type}/${id}`;
                        identity.debug_log.push(`Resolved profile: ${identity.sub}`);
                    }
                }

                const claimName = claims.name as string;
                if (claimName && !claimName.startsWith("http") && !claimName.startsWith("Practitioner/") && !claimName.startsWith("Patient/")) {
                    identity.name = claimName;
                    identity.debug_log.push(`Name from id_token: ${claimName}`);
                }
            } catch (e) {
                identity.debug_log.push(`id_token error: ${String(e)}`);
            }
        }

        // Plan C: If still empty, assume sub might provide a path to the user resource
        // If sub is a bare ID (e.g. 123), try Practitioner first, then Patient.
        if (!identity.name && identity.sub && identity.sub !== "unknown" && iss) {
            let targets: string[] = [];

            // If it already looks like a resource path (e.g. Practitioner/123), try that first
            if (identity.sub.includes("/") && !identity.sub.startsWith("http")) {
                targets.push(identity.sub);
            } else if (!identity.sub.startsWith("http")) {
                // Heuristic for bare ID: Try Practitioner first, then Patient
                targets.push(`Practitioner/${identity.sub}`);
                targets.push(`Patient/${identity.sub}`);
            }

            let found = false;

            for (const target of targets) {
                if (found) break;

                identity.debug_log.push(`Attempting fetch for: ${target}`);
                try {
                    const res = await fetch(`${iss}/${target}`, {
                        headers: { "Authorization": `Bearer ${tokenResponse.access_token}` }
                    });

                    identity.debug_log.push(`Fetch ${target} Status: ${res.status}`);

                    if (res.ok) {
                        const data = await res.json();
                        identity.debug_log.push(`Data Name: ${JSON.stringify(data?.name)}`);

                        const getName = (pt: any) => {
                            if (!pt?.name || pt.name.length === 0) return null;

                            // Try to find a name with use='official' or just take the first one
                            const n = pt.name.find((x: any) => x.use === 'official') || pt.name[0];

                            if (n.text) return n.text;
                            const family = n.family || "";

                            // Robust handling for 'given' which might be string or array
                            let given = "";
                            if (Array.isArray(n.given)) {
                                given = n.given.filter((g: any) => g !== "User").join(" ");
                            } else if (typeof n.given === "string") {
                                given = n.given;
                            }

                            return `${family} ${given}`.trim();
                        }

                        const fetchedName = getName(data);
                        if (fetchedName) {
                            identity.name = fetchedName;
                            // Update sub to the actual resource we found if it was ambiguous
                            if (identity.sub !== target) {
                                identity.sub = target;
                            }
                            identity.debug_log.push(`Fetched Name via ${target}: ${identity.name}`);
                            found = true;
                        } else {
                            identity.debug_log.push(`Name extraction failed for ${target}`);
                        }
                    } else {
                        // If not 200 OK, log it and try next target
                        const errBody = await res.text();
                        identity.debug_log.push(`${target} Fetch failed: ${errBody.substring(0, 50)}`);
                    }
                } catch (e) {
                    identity.debug_log.push(`Fetch Exception for ${target}: ${String(e)}`);
                }
            }
        }

        // 5. Store Tokens & Session -> Set on the RESPONSE object
        const redirectUrl = new URL("/dashboard", request.url);
        let authRedirectUrl = redirectUrl.toString();

        // --- 處理 Supabase 使用者對應 (Practitioner to Users Mapping) ---
        // 我們使用 Service Role Key（如果有設定）來自動幫醫師建立真實的 Supabase `auth.users` 帳號並登入，
        // 這樣就能正確通過所有 Row Level Security (RLS) 權限控管。
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

        if (supabaseUrl && serviceRoleKey) {
            try {
                const { createClient } = await import("@supabase/supabase-js");
                const adminAuthClient = createClient(supabaseUrl, serviceRoleKey, {
                    auth: { autoRefreshToken: false, persistSession: false }
                });

                const dummyEmail = identity.email || `${identity.sub.replace('/', '_')}@smart.local`.toLowerCase();

                const { data: usersData, error: listError } = await adminAuthClient.auth.admin.listUsers();
                let matchedUser = usersData?.users?.find(u => 
                    u.email === dummyEmail || 
                    u.user_metadata?.fhir_id === identity.sub
                );

                if (!matchedUser) {
                    console.log(`Auto-creating mapped user for FHIR identity: ${identity.sub}`);
                    const { data: newUser, error: createError } = await adminAuthClient.auth.admin.createUser({
                        email: dummyEmail,
                        password: crypto.randomUUID(), 
                        email_confirm: true,
                        user_metadata: {
                            full_name: identity.name,
                            fhir_id: identity.sub
                        }
                    });
                    
                    if (createError) {
                        console.error("Error creating mapped user:", createError);
                    } else if (newUser?.user) {
                        matchedUser = newUser.user;
                    }
                }

                if (matchedUser && matchedUser.email) {
                    const { data: linkData, error: linkError } = await adminAuthClient.auth.admin.generateLink({
                        type: 'magiclink',
                        email: matchedUser.email,
                        options: {
                            redirectTo: redirectUrl.toString()
                        }
                    });

                    if (!linkError && linkData?.properties?.action_link) {
                        console.log("Successfully generated login link for user.", matchedUser.id);
                        authRedirectUrl = linkData.properties.action_link;
                    } else {
                        console.error("Failed to generate magic link:", linkError);
                    }
                }
            } catch (authErr) {
                console.error("Error during Supabase Auto-Mapping:", authErr);
            }
        } else {
            console.warn("SUPABASE_SERVICE_ROLE_KEY not found. Fallback to anonymous session.");
        }

        // Create the FINAL Redirect Response before setting cookies
        const response = NextResponse.redirect(new URL(authRedirectUrl));

        const isProd = process.env.NODE_ENV === "production";
        const cookieSameSite = (isProd ? "none" : "lax") as "none" | "lax";

        console.log("Setting Auth Cookies...", {
            accessToken: tokenResponse.access_token ? "Yes" : "No",
            patient: tokenResponse.patient,
            identity: identity.name
        });

        const oneHour = 3600;
        response.cookies.set("fhir_access_token", tokenResponse.access_token, {
            httpOnly: true,
            secure: isProd,
            path: "/",
            sameSite: cookieSameSite,
            maxAge: oneHour,
        });

        if (tokenResponse.refresh_token) {
            response.cookies.set("fhir_refresh_token", tokenResponse.refresh_token, {
                httpOnly: true,
                secure: isProd,
                path: "/",
                sameSite: cookieSameSite,
                maxAge: oneHour * 24, // 1 day
            });
        }

        if (tokenResponse.patient) {
            response.cookies.set("fhir_patient", tokenResponse.patient, {
                httpOnly: true,
                secure: isProd,
                path: "/",
                sameSite: cookieSameSite
            });
        }

        if (identity.debug_log) {
            delete identity.debug_log;
        }

        response.cookies.set("fhir_user_identity", JSON.stringify(identity), {
            httpOnly: false, // Allow client to read for display
            secure: isProd,
            path: "/",
            sameSite: cookieSameSite
        });

        // Set a visible cookie for client-side
        response.cookies.set("smart_authenticated", "1", {
            httpOnly: false, 
            secure: isProd,
            path: "/",
            sameSite: cookieSameSite
        });

        return response;

    } catch (e) {
        console.error("Callback Error:", e);
        return NextResponse.redirect(new URL(`/login?error=token_request_error&details=${encodeURIComponent(String(e))}`, request.url));
    }
}
