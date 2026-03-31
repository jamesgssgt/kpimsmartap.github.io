import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());

async function main() {
    const url = "https://launcher.bdlfhir.net/v/r4/sim/WzQsIiIsIiIsIiIsMCwwLDAsIiIsIiIsImNjMzQ0NzI3LTZmOTAtNDk2Yy05NGZkLWM3ODI5YWE5YTUxZCIsIiIsIiIsIiIsIntcbiAgXCJrZXlzXCI6IFtcbiAgICB7XG4gICAgICBcImt0eVwiOiBcIlJTQVwiLFxuICAgICAgXCJuXCI6IFwicEtfd0x2aHBmN0EwOW5PRm9DQ19zMHpjS3V3MkVrV0g4NHFVaFZkOTlFeW1pUWFqN2JyOXA4VWMwUmMzcmxCZl9ERHhpbWM5d3B5V2hUSHFYYW1BY2hyalhtcTNzVS1LbnVJS2txSXpJWGJHUlI0VFVmLWZ6NUVWQWs2TnltWFV3ZXVrTHBmcFQ4NGlSbjh1N0QzRmYzUVJDbVl0TUxuaU5LM3ItV3pGU0pvWVA3RHFNSC13T3M4YkxzU0JaU1VDcFhEN01GRjNuS2Z0aFNzMzV5N3NkLWpsWUpWT3A3OWx1bFNIYUY4cGhVNFZPeGpPWWI1XzRGRlZ2ZGFlaHVUUVAxQnJINUdHN3VCa1lEUktOSkdlTmxfVUdPNzV4ekdPWkpzQzB1ZHZCckFJT19SMUd2RzhxcnNBaUpyUllQb2RPRnV4QUFWOHZMY0NlSFY3eWZVei1RXCIsXG4gICAgICBcImVcIjogXCJBUUFCXCIsXG4gICAgICBcImtpZFwiOiBcIjRhZmY5NTY0MGQyZjZlMzlkMzlhYTc0ZDc2YmMxYTczXCIsXG4gICAgICBcImFsZ1wiOiBcIlJTMzg0XCIsXG4gICAgICBcInVzZVwiOiBcInNpZ1wiXG4gICAgfVxuICBdXG59IiwxLDEsIiJd/fhir";
    const entry = [];
    for(let i=0; i<300; i++) {
        entry.push({
            resource: { resourceType: "Patient", id: `test-anon-post-${i}`, meta: { tag: [{system: "http://kpim.tw", code: "kpim_test_data"}]} },
            request: { method: "PUT", url: `Patient/test-anon-post-${i}` }
        });
    }
    const body = { resourceType: "Bundle", type: "transaction", entry };
    const start = Date.now();
    const res = await fetch(url, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body)
    });
    console.log("Response:", res.status, "Time:", Date.now()-start, "ms");
}
main();
