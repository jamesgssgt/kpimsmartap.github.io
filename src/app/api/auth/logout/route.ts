import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
    // Determine redirect target (login page with logout flag)
    const redirectUrl = new URL("/login?logout=true", request.url);
    const response = NextResponse.redirect(redirectUrl);

    // List of cookies to clear
    const cookiesToClear = [
        "fhir_access_token",
        "fhir_refresh_token",
        "fhir_patient",
        "fhir_user_identity",
        "smart_authenticated",
        "smart_state",
        "smart_iss",
        "smart_code_verifier"
    ];

    // Clear each cookie explicitly
    cookiesToClear.forEach(name => {
        response.cookies.set(name, "", {
            maxAge: 0,
            path: "/",
            expires: new Date(0)
        });
    });

    console.log("SMART Logout: Cleared all FHIR cookies.");

    return response;
}
