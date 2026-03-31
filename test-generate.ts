import { generateDataV2, exportFHIRTestCases } from "./src/app/actions/generate-data";

async function run() {
    console.log("Starting generateDataV2...");
    try {
        const res = await generateDataV2("mortality");
        console.log("Result:", res);
    } catch (e) {
        console.error("Caught error:", e);
    }
}
run();
