import { NextResponse } from 'next/server';
import { exportJWK, importSPKI } from 'jose';
import { SMART_CONFIG } from '@/utils/smart-conf';

export async function GET() {
    if (!SMART_CONFIG.publicKey) {
        return NextResponse.json({ error: "Server is missing PUBLIC_KEY configuration for asymmetric auth." }, { status: 404 });
    }

    try {
        const publicKeyPem = SMART_CONFIG.publicKey.replace(/\\n/g, '\n');
        
        // Import PEM to jose 
        const publicKeyObj = await importSPKI(publicKeyPem, SMART_CONFIG.signingAlg);
        
        // Export as JWK
        const jwk = await exportJWK(publicKeyObj);
        
        // Add necessary fields for FHIR Authorization Server validation
        jwk.kid = SMART_CONFIG.keyId;
        jwk.alg = SMART_CONFIG.signingAlg;
        jwk.use = 'sig';

        const jwks = {
            keys: [jwk]
        };

        return NextResponse.json(jwks, {
            headers: {
                'Content-Type': 'application/jwk-set+json',
                'Access-Control-Allow-Origin': '*' // Allow auth server to fetch it via CORS
            }
        });
    } catch (e) {
        console.error("JWKS rendering error:", e);
        return NextResponse.json({ error: "Failed to assemble JWKS file" }, { status: 500 });
    }
}
