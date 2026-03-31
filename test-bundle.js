const FHIR_SERVER_URL = "https://launch.smarthealthit.org/v/r4/fhir";

async function run() {
    const entry = [];
    for (let i = 0; i < 500; i++) {
        entry.push({
            fullUrl: `urn:uuid:pat-sim-test-${i}`,
            resource: {
                resourceType: "Patient",
                id: `pat-sim-test-${i}`,
                gender: "male",
                birthDate: "1980-01-01"
            },
            request: { method: "PUT", url: `Patient/pat-sim-test-${i}` }
        });
    }
    const bundle = {
        resourceType: "Bundle",
        type: "transaction",
        entry: entry
    };

    console.log("Sending bundle of 500 patients to:", FHIR_SERVER_URL);
    const start = Date.now();
    try {
        const res = await fetch(FHIR_SERVER_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(bundle)
        });
        const duration = Date.now() - start;
        console.log(`Status: ${res.status}, Time: ${duration}ms`);
        if (!res.ok) {
            console.error(await res.text());
        } else {
            console.log("Success!");
        }
    } catch (e) {
        console.error("Error:", e);
    }
}
run();
