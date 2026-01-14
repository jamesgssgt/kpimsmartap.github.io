import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { fhirUrl, measureId, periodStart, periodEnd, patientId, reportType } = body;

        if (!fhirUrl || !measureId || !periodStart || !periodEnd) {
            return NextResponse.json({ error: "Missing required parameters" }, { status: 400 });
        }

        // Validate URL
        // Validate URL protocol
        const baseUrl = fhirUrl.trim().replace(/\/$/, '');
        if (!baseUrl.match(/^https?:\/\//)) {
            return NextResponse.json({ error: "Invalid FHIR URL Protocol: Must start with http:// or https://" }, { status: 400 });
        }

        // Construct $evaluate-measure URL
        // Using GET format with query params is common, but POST is also supported.
        // Let's use GET for standard compatibility if parameters are simple.
        // Construct $evaluate-measure URL
        // Construct $evaluate-measure URL
        // Using standard Instance-Level GET: [base]/Measure/[id]/$evaluate-measure
        // This is the canonical way to execute a measure on a specific instance.
        const url = new URL(`${baseUrl}/Measure/${measureId}/$evaluate-measure`);

        url.searchParams.append("periodStart", periodStart);
        url.searchParams.append("periodEnd", periodEnd);

        if (patientId) {
            url.searchParams.append("subject", patientId.startsWith("Patient/") ? patientId : `Patient/${patientId}`);
        }

        // Add reportType if needed, though servers often default correctly
        if (reportType) {
            url.searchParams.append("reportType", reportType);
        } else {
            url.searchParams.append("reportType", patientId ? "subject" : "population");
        }

        console.log(`[Evaluate Proxy] Calling GET (Instance Level): ${url.toString()}`);

        const response = await fetch(url.toString(), {
            method: "GET",
            headers: {
                "Content-Type": "application/fhir+json",
                "Accept": "application/fhir+json"
            }
        });

        const responseText = await response.text();
        let responseJson;
        try {
            responseJson = JSON.parse(responseText);
        } catch {
            responseJson = { text: responseText };
        }

        if (!response.ok) {
            console.error(`[Evaluate Proxy] Upstream Error ${response.status}:`, responseText);
            return NextResponse.json({
                error: `Upstream FHIR Server Error: ${response.status}`,
                details: responseJson
            }, { status: response.status });
        }

        return NextResponse.json(responseJson);

    } catch (error: any) {
        console.error("[Evaluate Proxy] Internal Error:", error);
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}
