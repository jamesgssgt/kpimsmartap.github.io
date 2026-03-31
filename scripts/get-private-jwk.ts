import * as crypto from 'crypto';
import { loadEnvConfig } from '@next/env';

loadEnvConfig(process.cwd());

const privKeyPem = (process.env.SMART_PRIVATE_KEY || '').replace(/\\n/g, '\n');
const keyId = process.env.SMART_KEY_ID;
const signingAlg = process.env.SMART_SIGNING_ALG || 'RS384';

if (!privKeyPem) {
    console.error("No SMART_PRIVATE_KEY found in .env.local");
    process.exit(1);
}

try {
    const privKey = crypto.createPrivateKey(privKeyPem);
    const jwk = privKey.export({ format: 'jwk' });

    // Add required SMART fields expected by the tester
    jwk.kid = keyId;
    jwk.alg = signingAlg;
    
    console.log(JSON.stringify(jwk, null, 2));
} catch (error) {
    console.error("Error converting key:", error);
}
