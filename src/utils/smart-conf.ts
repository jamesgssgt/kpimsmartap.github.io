export const SMART_CONFIG = {
    // In a real app, these should be environment variables
    clientId: process.env.SMART_CLIENT_ID || "my-client-id",

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

    iss: process.env.SMART_ISS || "https://launch.smarthealthit.org/v/r4/fhir",
    scope: process.env.SMART_SCOPE || "patient/Patient.read patient/Observation.read launch online_access openid profile",

    redirectUri: typeof window !== "undefined"
        ? window.location.origin + "/api/auth/smart/callback"
        : "http://localhost:3000/api/auth/smart/callback",
};

// Helper to get token endpoint (simplified discovery)
export async function getSmartMetadata(iss: string) {
    try {
        const wellKnown = await fetch(`${iss}/.well-known/smart-configuration`).then(r => r.json());
        return wellKnown;
    } catch (e) {
        // Fallback for some servers or if well-known missing, try conformance
        const capability = await fetch(`${iss}/metadata`).then(r => r.json());
        // Parse capability statement logic would go here
        // For now returning mock or assuming well-known works for Sandbox
        return null;
    }
}
