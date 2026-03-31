import * as crypto from 'crypto';
import { loadEnvConfig } from '@next/env';

loadEnvConfig(process.cwd());

const pubKeyPem = (process.env.SMART_PUBLIC_KEY || '').replace(/\\n/g, '\n');
const keyId = process.env.SMART_KEY_ID;
const signingAlg = process.env.SMART_SIGNING_ALG || 'RS384';

if (!pubKeyPem) {
    console.error("No SMART_PUBLIC_KEY found in .env.local");
    process.exit(1);
}

try {
    const pubKey = crypto.createPublicKey(pubKeyPem);
    const jwk = pubKey.export({ format: 'jwk' });

    // Add required SMART fields
    jwk.kid = keyId;
    jwk.alg = signingAlg;
    jwk.use = 'sig';

    const jwks = { keys: [jwk] };
    
    console.log(JSON.stringify(jwks, null, 2));
} catch (error) {
    console.error("Error converting key:", error);
}
