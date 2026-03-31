import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());
import { syncFhirData } from '../src/app/actions/sync-data';

async function main() {
    try {
        console.log("Starting debug sync...");
        const result = await syncFhirData();
        console.log("Sync result:", result);
    } catch (e: any) {
         console.error("Sync error:", Object.getOwnPropertyNames(e).reduce((acc: any, key) => {
              acc[key] = e[key];
              return acc;
          }, {}));
    }
}
main();
