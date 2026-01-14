import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { fhirUrl, resource } = body;

        if (!fhirUrl || !resource) {
            return NextResponse.json({ error: "Missing fhirUrl or resource" }, { status: 400 });
        }

        // Validate URL protocol
        if (!fhirUrl || !fhirUrl.trim().match(/^https?:\/\//)) {
            return NextResponse.json({ error: "Invalid FHIR URL Protocol: " + fhirUrl }, { status: 400 });
        }

        const targetUrl = `${fhirUrl.replace(/\/$/, '')}/Measure/${resource.id}`;

        console.log(`[Proxy] Deploying Measure ${resource.id} to ${targetUrl}`);

        const response = await fetch(targetUrl, {
            method: "PUT",
            headers: {
                "Content-Type": "application/fhir+json",
                // Pass through generic accept header
                "Accept": "application/fhir+json"
            },
            body: JSON.stringify(resource),
        });

        // Get response text (it might be JSON or text or HTML error)
        const responseText = await response.text();
        let responseJson;
        try {
            responseJson = JSON.parse(responseText);
        } catch {
            responseJson = { text: responseText };
        }

        if (!response.ok) {
            console.error(`[Proxy] Upstream Error ${response.status}:`, responseText);
            return NextResponse.json({
                error: `Upstream FHIR Server Error: ${response.status}`,
                details: responseJson
            }, { status: response.status });
        }

        return NextResponse.json(responseJson);

    } catch (error: any) {
        console.error("[Proxy] Internal Error:", error);
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}
