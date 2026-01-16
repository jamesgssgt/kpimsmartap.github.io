"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle2, XCircle, AlertCircle, Loader2, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface SmartMetadata {
    issuer?: string;
    jwks_uri?: string;
    authorization_endpoint?: string;
    grant_types_supported?: string[];
    token_endpoint?: string;
    capabilities?: string[];
    code_challenge_methods_supported?: string[];
    scopes_supported?: string[];
    introspection_endpoint?: string;
    [key: string]: any;
}

interface ValidationResult {
    field: string;
    required: boolean;
    present: boolean;
    value?: any;
    description: string;
}

const REQUIRED_FIELDS = [
    { key: "issuer", label: "Issuer", description: "OIDC Issuer Identifier" },
    { key: "jwks_uri", label: "JWKS URI", description: "URL of the OP's JSON Web Key Set document" },
    { key: "authorization_endpoint", label: "Authorization Endpoint", description: "URL of the OP's OAuth 2.0 Authorization Endpoint" },
    { key: "grant_types_supported", label: "Grant Types Supported", description: "JSON array containing a list of the OAuth 2.0 Grant Type values that this OP supports" },
    { key: "token_endpoint", label: "Token Endpoint", description: "URL of the OP's OAuth 2.0 Token Endpoint" },
    { key: "capabilities", label: "Capabilities", description: "JSON array containing a list of the OAuth 2.0 capabilities that this OP supports" },
    { key: "code_challenge_methods_supported", label: "Code Challenge Methods", description: "JSON array containing a list of the PKCE code challenge methods that this OP supports" },
];

const SUGGESTED_FIELDS = [
    { key: "scopes_supported", label: "Scopes Supported", description: "JSON array containing a list of the OAuth 2.0 [RFC6749] scope values that this OP supports" },
    { key: "introspection_endpoint", label: "Introspection Endpoint", description: "URL of the OP's OAuth 2.0 Introspection Endpoint" },
];

export default function CheckPage() {
    const [iss, setIss] = useState("https://hapi.fhir.tw/fhir");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [metadata, setMetadata] = useState<SmartMetadata | null>(null);
    const [validationResults, setValidationResults] = useState<ValidationResult[]>([]);

    const handleCheck = async () => {
        setLoading(true);
        setError(null);
        setMetadata(null);
        setValidationResults([]);

        try {
            // Clean up the URL
            let baseUrl = iss.trim();
            if (baseUrl.endsWith("/")) {
                baseUrl = baseUrl.slice(0, -1);
            }

            const configUrl = `${baseUrl}/.well-known/smart-configuration`;

            const response = await fetch(configUrl);

            if (!response.ok) {
                throw new Error(`Failed to fetch metadata. Status: ${response.status} ${response.statusText}`);
            }

            const data: SmartMetadata = await response.json();
            setMetadata(data);

            const results: ValidationResult[] = [];

            // Check Required Fields
            REQUIRED_FIELDS.forEach(field => {
                results.push({
                    field: field.label,
                    required: true,
                    present: data.hasOwnProperty(field.key) && data[field.key] !== undefined && data[field.key] !== null,
                    value: data[field.key],
                    description: field.description
                });
            });

            // Check Suggested Fields
            SUGGESTED_FIELDS.forEach(field => {
                results.push({
                    field: field.label,
                    required: false,
                    present: data.hasOwnProperty(field.key) && data[field.key] !== undefined && data[field.key] !== null,
                    value: data[field.key],
                    description: field.description
                });
            });

            setValidationResults(results);

        } catch (err: any) {
            setError(err.message || "An unexpected error occurred");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="container mx-auto py-10 px-4 max-w-5xl">
            <div className="space-y-6">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">SMART Configuration Check</h1>
                    <p className="text-muted-foreground mt-2">
                        Validate FHIR Server's SMART on FHIR metadata (<code>.well-known/smart-configuration</code>) against TWPAS IG requirements.
                    </p>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Verification Target</CardTitle>
                        <CardDescription>Enter the Base URL of the FHIR Server</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex w-full items-end gap-4">
                            <div className="grid w-full gap-1.5">
                                <Label htmlFor="iss">FHIR Server URL (iss)</Label>
                                <Input
                                    id="iss"
                                    value={iss}
                                    onChange={(e) => setIss(e.target.value)}
                                    placeholder="https://example.com/fhir"
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            handleCheck();
                                        }
                                    }}
                                />
                            </div>
                            <Button onClick={handleCheck} disabled={loading} className="min-w-[120px]">
                                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Check"}
                            </Button>
                        </div>
                        {error && (
                            <div className="mt-4 p-4 bg-destructive/15 text-destructive rounded-md flex items-center gap-2">
                                <XCircle className="h-5 w-5" />
                                <span>{error}</span>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {validationResults.length > 0 && metadata && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-6">
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                                        Validation Results
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="space-y-4">
                                        <h3 className="font-semibold text-lg flex items-center gap-2 border-b pb-2">
                                            Required Fields
                                            <span className="text-xs font-normal text-muted-foreground ml-auto">Should be present</span>
                                        </h3>
                                        {validationResults.filter(r => r.required).map((result, idx) => (
                                            <div key={idx} className="flex items-start gap-3 p-2 rounded hover:bg-muted/50 transition-colors">
                                                {result.present ? (
                                                    <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />
                                                ) : (
                                                    <XCircle className="h-5 w-5 text-red-500 mt-0.5 shrink-0" />
                                                )}
                                                <div className="overflow-hidden">
                                                    <p className="font-medium text-sm">{result.field}</p>
                                                    <p className="text-xs text-muted-foreground truncate">{result.description}</p>
                                                    {result.present && (
                                                        <pre className="mt-1 text-xs bg-muted p-1 rounded overflow-x-auto max-w-[300px] md:max-w-full">
                                                            {typeof result.value === 'object' ? JSON.stringify(result.value) : String(result.value)}
                                                        </pre>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="space-y-4 mt-6">
                                        <h3 className="font-semibold text-lg flex items-center gap-2 border-b pb-2">
                                            Suggested Fields
                                            <span className="text-xs font-normal text-muted-foreground ml-auto">Recommended</span>
                                        </h3>
                                        {validationResults.filter(r => !r.required).map((result, idx) => (
                                            <div key={idx} className="flex items-start gap-3 p-2 rounded hover:bg-muted/50 transition-colors">
                                                {result.present ? (
                                                    <CheckCircle2 className="h-5 w-5 text-blue-500 mt-0.5 shrink-0" />
                                                ) : (
                                                    <AlertCircle className="h-5 w-5 text-yellow-500 mt-0.5 shrink-0" />
                                                )}
                                                <div className="overflow-hidden">
                                                    <p className="font-medium text-sm">{result.field}</p>
                                                    <p className="text-xs text-muted-foreground truncate">{result.description}</p>
                                                    {result.present && (
                                                        <pre className="mt-1 text-xs bg-muted p-1 rounded overflow-x-auto max-w-[300px] md:max-w-full">
                                                            {typeof result.value === 'object' ? JSON.stringify(result.value) : String(result.value)}
                                                        </pre>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        <div className="space-y-6">
                            <Card className="h-full">
                                <CardHeader>
                                    <CardTitle>Raw Metadata Response</CardTitle>
                                    <CardDescription>
                                        Content of .well-known/smart-configuration
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="bg-slate-950 text-slate-50 p-4 rounded-lg overflow-auto max-h-[800px] text-xs font-mono">
                                        <pre>{JSON.stringify(metadata, null, 2)}</pre>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
