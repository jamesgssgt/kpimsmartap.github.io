import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());

async function main() {
    const { getBackendAccessToken } = await import('../src/utils/backend-auth');
    console.log("Starting backend auth test...");
    try {
        const fhirBaseUrl = process.env.NEXT_PUBLIC_FHIR_BASE_URL || "https://launch.smarthealthit.org/v/r4/fhir";
        console.log(`Using FHIR Base URL: ${fhirBaseUrl}`);
        
        const token = await getBackendAccessToken(fhirBaseUrl);
        
        if (token) {
            console.log("\n✅ Successfully obtained Backend Access Token!");
            console.log("==========================================");
            console.log(token);
            console.log("==========================================\n");
            
            // Try to decode JWT if it's a valid format
            if (token.split('.').length === 3) {
                try {
                    const payload = Buffer.from(token.split('.')[1], 'base64').toString();
                    console.log("Token Payload:");
                    console.log(JSON.stringify(JSON.parse(payload), null, 2));
                } catch (e) {
                    console.log("Token is not a decodable JWT or obfuscated.");
                }
            }
        } else {
            console.log("\n❌ Failed to obtain Token: getBackendAccessToken returned null.");
        }
    } catch (error) {
        console.error("\n❌ Error occurred during backend auth test:", error);
    }
}

main();
