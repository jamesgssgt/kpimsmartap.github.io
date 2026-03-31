import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());

async function main() {
    const fhirBaseUrl = process.argv[2] || "https://launcher.bdlfhir.net/v/r4/sim/WzQsIiIsIiIsIiIsMCwwLDAsIiIsIiIsImNjMzQ0NzI3LTZmOTAtNDk2Yy05NGZkLWM3ODI5YWE5YTUxZCIsIiIsIiIsIiIsIntcbiAgXCJrZXlzXCI6IFtcbiAgICB7XG4gICAgICBcImt0eVwiOiBcIlJTQVwiLFxuICAgICAgXCJuXCI6IFwicEtfd0x2aHBmN0EwOW5PRm9DQ19zMHpjS3V3MkVrV0g4NHFVaFZkOTlFeW1pUWFqN2JyOXA4VWMwUmMzcmxCZl9ERHhpbWM5d3B5V2hUSHFYYW1BY2hyalhtcTNzVS1LbnVJS2txSXpJWGJHUlI0VFVmLWZ6NUVWQWs2TnltWFV3ZXVrTHBmcFQ4NGlSbjh1N0QzRmYzUVJDbVl0TUxuaU5LM3ItV3pGU0pvWVA3RHFNSC13T3M4YkxzU0JaU1VDcFhEN01GRjNuS2Z0aFNzMzV5N3NkLWpsWUpWT3A3OWx1bFNIYUY4cGhVNFZPeGpPWWI1XzRGRlZ2ZGFlaHVUUVAxQnJINUdHN3VCa1lEUktOSkdlTmxfVUdPNzV4ekdPWkpzQzB1ZHZCckFJT19SMUd2RzhxcnNBaUpyUllQb2RPRnV4QUFWOHZMY0NlSFY3eWZVei1RXCIsXG4gICAgICBcImVcIjogXCJBUUFCXCIsXG4gICAgICBcImtpZFwiOiBcIjRhZmY5NTY0MGQyZjZlMzlkMzlhYTc0ZDc2YmMxYTczXCIsXG4gICAgICBcImFsZ1wiOiBcIlJTMzg0XCIsXG4gICAgICBcInVzZVwiOiBcInNpZ1wiXG4gICAgfVxuICBdXG59IiwxLDEsIiJd/fhir";
    const { getBackendAccessToken } = await import('../src/utils/backend-auth');
    const accessToken = await getBackendAccessToken(fhirBaseUrl);
    
    console.log("Token obtained:", !!accessToken);
    
    const url = `${fhirBaseUrl}/Patient?_count=10`;
    const headers: any = { "Accept": "application/json" };
    if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;
    
    const res = await fetch(url, { headers });
    console.log("Status:", res.status);
    
    if (res.ok) {
        const bundle = await res.json();
        console.log("Patients length:", bundle.entry?.length || 0);
    } else {
        console.error("Fetch Error:", await res.text());
    }
}
main();
