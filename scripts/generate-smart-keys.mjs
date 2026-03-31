import * as crypto from 'crypto';

crypto.generateKeyPair('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: {
        type: 'spki',
        format: 'pem'
    },
    privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem'
    }
}, (err, publicKey, privateKey) => {
    if (err) {
        console.error("生成金鑰失敗:", err);
        process.exit(1);
    }
    
    // 隨機產生 KID
    const kid = crypto.randomBytes(16).toString('hex');
    
    console.log("\n========== .env.local ==========");
    console.log("SMART_AUTH_TYPE=asymmetric");
    console.log(`SMART_KEY_ID="${kid}"`);
    console.log(`SMART_SIGNING_ALG="RS384"`);
    console.log(`SMART_PRIVATE_KEY="${privateKey.replace(/\n/g, '\\n')}"`);
    console.log(`SMART_PUBLIC_KEY="${publicKey.replace(/\n/g, '\\n')}"`);
    console.log("================================\n");
    console.log("請將上述變數加入到您的 .env.local 檔案中，以便系統啟動時讀取這些密鑰。\n您也可以複製上述的 .env 格式。\n");
});
