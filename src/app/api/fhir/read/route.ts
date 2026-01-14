import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { fhirUrl, path } = body;

        if (!fhirUrl || !path) {
            return NextResponse.json({ error: "Missing fhirUrl or path" }, { status: 400 });
        }

        const baseUrl = fhirUrl.trim().replace(/\/$/, '');
        // Validate URL
        if (!baseUrl.match(/^https?:\/\//)) {
            return NextResponse.json({ error: "Invalid FHIR URL Protocol" }, { status: 400 });
        }

        const targetUrl = `${baseUrl}/${path}`;

        console.log(`[Read Proxy] Fetching: ${targetUrl}`);

        const response = await fetch(targetUrl, {
            method: "GET",
            headers: {
                "Accept": "application/fhir+json, application/json"
            }
        });

        const contentType = response.headers.get("content-type");
        const responseText = await response.text();

        let responseJson;
        try {
            responseJson = JSON.parse(responseText);
        } catch {
            // If not JSON, return as text wrapper
            responseJson = {
                error: "Invalid JSON Response",
                contentType: contentType,
                raw: responseText.substring(0, 1000) // Truncate
            };
        }

        if (contentType && contentType.includes("text/html")) {
            return NextResponse.json({
                error: "Server returned HTML instead of FHIR JSON. Check your URL.",
                urlUsed: targetUrl,
                preview: responseText.substring(0, 500)
            }, { status: 400 });
        }

        if (!response.ok) {
            return NextResponse.json({
                error: `Upstream FHIR Server Error: ${response.status}`,
                urlUsed: targetUrl,
                details: responseJson
            }, { status: response.status });
        }

        return NextResponse.json(responseJson);

    } catch (error: any) {
        console.error("[Read Proxy] Internal Error:", error);
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}
