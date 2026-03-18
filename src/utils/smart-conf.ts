export const SMART_CONFIG = {
    // In a real app, these should be environment variables
    clientId: process.env.SMART_CLIENT_ID || "KPIM_SMART_AP",

    // Auth Type: 'symmetric' (Client Secret) or 'asymmetric' (Private Key JWT)
    authType: (process.env.SMART_AUTH_TYPE as 'symmetric' | 'asymmetric') || 'symmetric',

    // Symmetric Config
    clientSecret: process.env.SMART_CLIENT_SECRET || "my-client-secret",

    // Asymmetric Config (THAS Requirement)
    // PEM format private key
    privateKey: process.env.SMART_PRIVATE_KEY || "",
    // Key ID (kid) registered with the Authorization Server
    keyId: process.env.SMART_KEY_ID || "my-key-id",
    // Algorithm to sign the JWT (usually RS384 or ES384 for FHIR, but RS256 is common default)
    signingAlg: process.env.SMART_SIGNING_ALG || "RS384",

    // Fix: Use SMART Sandbox FHIR Server by default since hapi.fhir.tw doesn't support SMART Auth
    iss: process.env.SMART_ISS || "https://launch.smarthealthit.org/v/r4/fhir",
    scope: process.env.SMART_SCOPE || "launch patient/Encounter.read patient/Patient.read user/Practitioner.read openid profile",

    redirectUri: typeof window !== "undefined"
        ? window.location.origin + "/api/auth/smart/callback"
        : "http://localhost:3000/api/auth/smart/callback",
};

// Helper to get token endpoint (simplified discovery)
export async function getSmartMetadata(iss: string) {
    // Helper to safe fetch
    const safeFetch = async (url: string) => {
        let res = await fetch(url);

        // If 404, try appending /fhir to the base if likely missing
        if (!res.ok && res.status === 404 && !url.includes("/fhir/")) {
            // Basic heuristic: insert /fhir before .well-known or metadata
            const newUrl = url.replace(/(\.well-known\/smart-configuration|metadata)/, "fhir/$1");
            console.log(`Initial fetch 404, retrying with: ${newUrl}`);
            const retryRes = await fetch(newUrl);
            if (retryRes.ok) {
                res = retryRes;
            }
        }

        if (!res.ok) {
            throw new Error(`Fetch failed: ${res.status} for ${url}`);
        }

        const text = await res.text();
        try {
            return JSON.parse(text);
        } catch (e) {
            console.error(`Invalid JSON from ${url} (or retry):`, text.substring(0, 50));
            throw new Error(`Invalid JSON response`);
        }
    };

    try {
        const wellKnown = await safeFetch(`${iss}/.well-known/smart-configuration`);
        return wellKnown;
    } catch (e) {
        console.warn("Well-known lookup failed, trying metadata...", e);
        try {
            // Fallback for some servers or if well-known missing, try conformance
            const capability = await safeFetch(`${iss}/metadata`);
            // Parse capability statement logic would go here
            // For now returning mock or assuming well-known works for Sandbox
            return null;
        } catch (e2) {
            console.error("Metadata lookup failed", e2);
            return null;
        }
    }
}
