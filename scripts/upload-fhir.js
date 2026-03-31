const fs = require('fs');

async function uploadBundle(filePath) {
    console.log(`Reading FHIR Bundle from ${filePath}...`);
    let data = fs.readFileSync(filePath, 'utf-8');
    
    // 預先解析以建立 UUID 到真實 ResourceType/ID 的對應表
    const tempBundle = JSON.parse(data);
    if (!tempBundle.entry || !Array.isArray(tempBundle.entry)) {
        console.error("Invalid FHIR Bundle: 'entry' array not found.");
        return;
    }
    
    console.log("Analyzing cross-references and rewriting urn:uuid links...");
    const uuidMap = {};
    tempBundle.entry.forEach(e => {
        const res = e.resource;
        if (res && res.id) {
            uuidMap[`urn:uuid:${res.id}`] = `${res.resourceType}/${res.id}`;
            // 處理完整網址替換（避免完整網址與內部資源互不相認）
            if (e.fullUrl === `urn:uuid:${res.id}`) {
                e.fullUrl = `${res.resourceType}/${res.id}`;
            }
        }
    });

    // 進行字串全域替換，將所有參考 urn:uuid 換成實體 ID (例如 Practitioner/123)
    for (const [urn, realRef] of Object.entries(uuidMap)) {
        data = data.split(`"${urn}"`).join(`"${realRef}"`);
    }

    const bundle = JSON.parse(data);
    const entries = bundle.entry;
    console.log(`Total resources to upload: ${entries.length}`);

    const CHUNK_SIZE = 200; // SMART Sandbox can safely handle ~200 resources per request
    const FHIR_SERVER_URL = "https://launch.smarthealthit.org/v/r4/fhir";

    let successCount = 0;
    
    for (let i = 0; i < entries.length; i += CHUNK_SIZE) {
        const chunk = entries.slice(i, i + CHUNK_SIZE);
        const chunkBundle = {
            resourceType: "Bundle",
            type: "transaction",
            entry: chunk
        };

        console.log(`Uploading chunk ${Math.floor(i / CHUNK_SIZE) + 1} of ${Math.ceil(entries.length / CHUNK_SIZE)} (resources ${i} to ${i + chunk.length - 1})...`);
        
        try {
            const res = await fetch(FHIR_SERVER_URL, {
                method: "POST",
                headers: { "Content-Type": "application/fhir+json" },
                body: JSON.stringify(chunkBundle)
            });

            if (res.ok) {
                console.log(`✅ Chunk ${Math.floor(i / CHUNK_SIZE) + 1} uploaded successfully.`);
                successCount += chunk.length;
            } else {
                console.error(`❌ Chunk ${Math.floor(i / CHUNK_SIZE) + 1} failed with status: ${res.status}`);
                const errText = await res.text();
                console.error("Response:", errText);
                // Optionally stop on error
                // process.exit(1); 
            }
        } catch (err) {
            console.error(`❌ Network Error on chunk ${Math.floor(i / CHUNK_SIZE) + 1}:`, err.message);
        }
    }

    console.log(`\nUpload complete! Successfully uploaded ${successCount} out of ${entries.length} resources.`);
}

const args = process.argv.slice(2);
if (args.length === 0) {
    console.error("Please provide the path to the JSON file.\nUsage: node upload-fhir.js <path-to-file.json>");
    process.exit(1);
}

uploadBundle(args[0]);
