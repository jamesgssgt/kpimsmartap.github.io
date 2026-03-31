import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());
import * as jose from "jose";

async function main() {
    const fhirBaseUrl = process.argv[2] || "https://launcher.bdlfhir.net/v/r4/sim/WzQsIiIsIiIsIiIsMCwwLDAsIiIsIiIsImNjMzQ0NzI3LTZmOTAtNDk2Yy05NGZkLWM3ODI5YWE5YTUxZCIsIiIsIiIsIiIsIntcbiAgXCJrZXlzXCI6IFtcbiAgICB7XG4gICAgICBcImt0eVwiOiBcIlJTQVwiLFxuICAgICAgXCJuXCI6IFwicEtfd0x2aHBmN0EwOW5PRm9DQ19zMHpjS3V3MkVrV0g4NHFVaFZkOTlFeW1pUWFqN2JyOXA4VWMwUmMzcmxCZl9ERHhpbWM5d3B5V2hUSHFYYW1BY2hyalhtcTNzVS1LbnVJS2txSXpJWGJHUlI0VFVmLWZ6NUVWQWs2TnltWFV3ZXVrTHBmcFQ4NGlSbjh1N0QzRmYzUVJDbVl0TUxuaU5LM3ItV3pGU0pvWVA3RHFNSC13T3M4YkxzU0JaU1VDcFhEN01GRjNuS2Z0aFNzMzV5N3NkLWpsWUpWT3A3OWx1bFNIYUY4cGhVNFZPeGpPWWI1XzRGRlZ2ZGFlaHVUUVAxQnJINUdHN3VCa1lEUktOSkdlTmxfVUdPNzV4ekdPWkpzQzB1ZHZCckFJT19SMUd2RzhxcnNBaUpyUllQb2RPRnV4QUFWOHZMY0NlSFY3eWZVei1RXCIsXG4gICAgICBcImVcIjogXCJBUUFCXCIsXG4gICAgICBcImtpZFwiOiBcIjRhZmY5NTY0MGQyZjZlMzlkMzlhYTc0ZDc2YmMxYTczXCIsXG4gICAgICBcImFsZ1wiOiBcIlJTMzg0XCIsXG4gICAgICBcInVzZVwiOiBcInNpZ1wiXG4gICAgfVxuICBdXG59IiwxLDEsIiJd/fhir";
    const clientId = "cc344727-6f90-496c-94fd-c7829aa9a51d";
    let key;
    const pk = process.env.SMART_PRIVATE_KEY || "";
    if(!pk) throw new Error("no pk");
    key = await jose.importPKCS8(pk.replace(/\\n/g, '\n'), "RS384");
    
    const jwt = await new jose.SignJWT({
        iss: clientId, sub: clientId, aud: "https://launcher.bdlfhir.net/v/r4/sim/WzQsIiIsIiIsIiIsMCwwLDAsIiIsIiIsImNjMzQ0NzI3LTZmOTAtNDk2Yy05NGZkLWM3ODI5YWE5YTUxZCIsIiIsIiIsIiIsIntcbiAgXCJrZXlzXCI6IFtcbiAgICB7XG4gICAgICBcImt0eVwiOiBcIlJTQVwiLFxuICAgICAgXCJuXCI6IFwicEtfd0x2aHBmN0EwOW5PRm9DQ19zMHpjS3V3MkVrV0g4NHFVaFZkOTlFeW1pUWFqN2JyOXA4VWMwUmMzcmxCZl9ERHhpbWM5d3B5V2hUSHFYYW1BY2hyalhtcTNzVS1LbnVJS2txSXpJWGJHUlI0VFVmLWZ6NUVWQWs2TnltWFV3ZXVrTHBmcFQ4NGlSbjh1N0QzRmYzUVJDbVl0TUxuaU5LM3ItV3pGU0pvWVA3RHFNSC13T3M4YkxzU0JaU1VDcFhEN01GRjNuS2Z0aFNzMzV5N3NkLWpsWUpWT3A3OWx1bFNIYUY4cGhVNFZPeGpPWWI1XzRGRlZ2ZGFlaHVUUVAxQnJINUdHN3VCa1lEUktOSkdlTmxfVUdPNzV4ekdPWkpzQzB1ZHZCckFJT19SMUd2RzhxcnNBaUpyUllQb2RPRnV4QUFWOHZMY0NlSFY3eWZVei1RXCIsXG4gICAgICBcImVcIjogXCJBUUFCXCIsXG4gICAgICBcImtpZFwiOiBcIjRhZmY5NTY0MGQyZjZlMzlkMzlhYTc0ZDc2YmMxYTczXCIsXG4gICAgICBcImFsZ1wiOiBcIlJTMzg0XCIsXG4gICAgICBcInVzZVwiOiBcInNpZ1wiXG4gICAgfVxuICBdXG59IiwxLDEsIiJd/auth/token", jti: Math.random().toString()
    }).setProtectedHeader({ alg: "RS384", kid: "4aff95640d2f6e39d39aa74d76bc1a73", typ: 'JWT' }).setIssuedAt().setExpirationTime("5m").sign(key);
    
    const tokenUrl = "https://launcher.bdlfhir.net/v/r4/sim/WzQsIiIsIiIsIiIsMCwwLDAsIiIsIiIsImNjMzQ0NzI3LTZmOTAtNDk2Yy05NGZkLWM3ODI5YWE5YTUxZCIsIiIsIiIsIiIsIntcbiAgXCJrZXlzXCI6IFtcbiAgICB7XG4gICAgICBcImt0eVwiOiBcIlJTQVwiLFxuICAgICAgXCJuXCI6IFwicEtfd0x2aHBmN0EwOW5PRm9DQ19zMHpjS3V3MkVrV0g4NHFVaFZkOTlFeW1pUWFqN2JyOXA4VWMwUmMzcmxCZl9ERHhpbWM5d3B5V2hUSHFYYW1BY2hyalhtcTNzVS1LbnVJS2txSXpJWGJHUlI0VFVmLWZ6NUVWQWs2TnltWFV3ZXVrTHBmcFQ4NGlSbjh1N0QzRmYzUVJDbVl0TUxuaU5LM3ItV3pGU0pvWVA3RHFNSC13T3M4YkxzU0JaU1VDcFhEN01GRjNuS2Z0aFNzMzV5N3NkLWpsWUpWT3A3OWx1bFNIYUY4cGhVNFZPeGpPWWI1XzRGRlZ2ZGFlaHVUUVAxQnJINUdHN3VCa1lEUktOSkdlTmxfVUdPNzV4ekdPWkpzQzB1ZHZCckFJT19SMUd2RzhxcnNBaUpyUllQb2RPRnV4QUFWOHZMY0NlSFY3eWZVei1RXCIsXG4gICAgICBcImVcIjogXCJBUUFCXCIsXG4gICAgICBcImtpZFwiOiBcIjRhZmY5NTY0MGQyZjZlMzlkMzlhYTc0ZDc2YmMxYTczXCIsXG4gICAgICBcImFsZ1wiOiBcIlJTMzg0XCIsXG4gICAgICBcInVzZVwiOiBcInNpZ1wiXG4gICAgfVxuICBdXG59IiwxLDEsIiJd/auth/token";
    
    const res = await fetch(tokenUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Accept': 'application/json'
            },
            body: new URLSearchParams({
                grant_type: 'client_credentials',
                client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
                client_assertion: jwt,
                scope: "system/*.read", // THE OLD SCOPE
            }),
     });
     if(!res.ok) console.error("Error:", res.status, await res.text());
     else console.log("Success with old scope");
}
main();
