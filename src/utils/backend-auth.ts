import { SignJWT, importPKCS8 } from 'jose';
import { SMART_CONFIG, getSmartMetadata } from '@/utils/smart-conf';
import * as crypto from 'crypto';

// In-memory token cache to avoid requesting a token for every single request in sync
let cachedToken: string | null = null;
let tokenExpiresAt: number = 0;

export async function getBackendAccessToken(fhirBaseUrl: string): Promise<string | null> {
    // Return cached token if still valid (with 10-second buffer)
    if (cachedToken && Date.now() < tokenExpiresAt) {
        return cachedToken;
    }

    // 1. Get metadata from SMART well-known to find token_endpoint
    let tokenUrl = "";
    try {
        const metadata = await getSmartMetadata(fhirBaseUrl);
        if (metadata?.token_endpoint) {
            tokenUrl = metadata.token_endpoint;
        } else {
            // Default sandbox or fallback auth url if well-known is missing
            tokenUrl = `${fhirBaseUrl}/auth/token`;
        }
    } catch(e) {
        console.warn("Could not fetch smart configuration, falling back to default token endpoint");
        tokenUrl = "https://launch.smarthealthit.org/v/r4/auth/token"; // typical SMART sandbox default
    }

    if(!SMART_CONFIG.privateKey) {
        console.warn("Missing SMART_PRIVATE_KEY for asymmetric authorization. Sync could fail if token is required.");
        return null;
    }

    // parse PEM
    const privateKeyPem = SMART_CONFIG.privateKey.replace(/\\n/g, '\n');

    try {
        // Load private key via jose
        const privateKey = await importPKCS8(privateKeyPem, SMART_CONFIG.signingAlg);

        // 2. Create the Client Assertion JWT
        const clientAssertion = await new SignJWT({
            iss: SMART_CONFIG.clientId,
            sub: SMART_CONFIG.clientId,
            aud: tokenUrl,
            jti: crypto.randomUUID(), 
        })
            .setProtectedHeader({ alg: SMART_CONFIG.signingAlg, typ: 'JWT', kid: SMART_CONFIG.keyId })
            .setIssuedAt()
            .setExpirationTime('5m') // SMART guideline: max 5 min
            .sign(privateKey);

        // 3. fetch Access Token from Token Endpoint
        const body = new URLSearchParams({
            grant_type: 'client_credentials',
            client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
            client_assertion: clientAssertion,
            scope: "system/*.read system/*.write", // Requesting both read and write for data generation
        });

        console.log(`Requesting backend access token from ${tokenUrl}`);
        const res = await fetch(tokenUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Accept': 'application/json'
            },
            body: body.toString()
        });

        if (!res.ok) {
            const txt = await res.text();
            console.error("Backend Token request failed:", res.status, txt);
            throw new Error(`Failed to obtain backend access token: ${res.status} ${txt}`);
        }

        const json = await res.json();
        cachedToken = json.access_token;
        
        // expiresIn is usually in seconds
        const expiresIn = json.expires_in || 300; 
        tokenExpiresAt = Date.now() + (expiresIn - 10) * 1000;

        console.log("==========================================");
        console.log("Successfully acquired backend access token:");
        console.log(cachedToken);
        console.log("==========================================");
        return cachedToken;
    } catch (e) {
        console.error("Error generating client assertion or fetching token:", e);
        throw e;
    }
}
