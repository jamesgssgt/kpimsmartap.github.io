import React, { useState, useEffect } from 'react';
import { SMART_CONFIG } from '@/utils/smart-conf';

export function DeployButtons({ measure }: { measure: any }) {
    // 1. Try LocalStorage (from Settings page) 2. Fallback to Global Config
    const [fhirUrl, setFhirUrl] = useState(SMART_CONFIG.iss);

    useEffect(() => {
        // Initial load
        const stored = localStorage.getItem("KPIM_FHIR_URL");
        if (stored) {
            setFhirUrl(stored);
        }
    }, []);

    // Helper to get latest URL on demand
    const getFreshUrl = () => {
        const stored = localStorage.getItem("KPIM_FHIR_URL");
        const effectiveUrl = stored || SMART_CONFIG.iss; // Use stored, or default if stored is null/empty

        // Update state if the effective URL is different from the current state
        if (effectiveUrl !== fhirUrl) {
            setFhirUrl(effectiveUrl);
        }
        return effectiveUrl;
    };

    // State for verification result
    const [verifyResult, setVerifyResult] = useState<string | null>(null);

    // State for Evaluation
    const [showEvalForm, setShowEvalForm] = useState(false);
    const [evalParams, setEvalParams] = useState({
        periodStart: '2024-01-01',
        periodEnd: '2025-12-31',
        patientId: 'Patient/Patient-Test-001'
    });

    const deployToFHIR = async () => {
        setVerifyResult(null); // Clear previous result
        const currentFhirUrl = getFreshUrl();
        try {
            const baseUrl = currentFhirUrl.trim().replace(/\/$/, '');

            // 1. Create Dummy Library JSON (Required by HAPI FHIR for evaluation)
            const libId = `${measure.id}-lib`;
            const libCanonical = `http://kpim.example.org/Library/${libId}`; // Define canonical URL

            const libraryJson = {
                resourceType: 'Library',
                id: libId,
                url: libCanonical, // MUST have a canonical URL for resolution
                status: 'active',
                type: {
                    coding: [{
                        system: "http://terminology.hl7.org/CodeSystem/library-type",
                        code: "logic-library"
                    }]
                },
                content: [{
                    contentType: "text/cql",
                    data: "" // Empty content
                }]
            };

            // 2. Create Measure JSON with Library Reference
            const measureJson = {
                resourceType: 'Measure',
                id: measure.id,
                url: `http://kpim.example.org/Measure/${measure.id}`, // Add canonical URL
                title: measure.title,
                status: 'active', // Evaluatable measures usually need to be active
                library: [libCanonical], // Link to the library by CANONICAL URL
                group: [{
                    population: [
                        {
                            code: {
                                coding: [{
                                    system: "http://terminology.hl7.org/CodeSystem/measure-population",
                                    code: "denominator"
                                }]
                            },
                            criteria: {
                                language: 'text/fhirpath',
                                expression: `'Include: ${measure.denominator.resources.join(', ')}'`
                            }
                        },
                        {
                            code: {
                                coding: [{
                                    system: "http://terminology.hl7.org/CodeSystem/measure-population",
                                    code: "numerator"
                                }]
                            },
                            criteria: {
                                language: 'text/fhirpath',
                                expression: `'Include: ${measure.numerator.resources.join(', ')}'`
                            }
                        }
                    ]
                }]
            };

            // 3. Deploy Library First
            const libResponse = await fetch('/api/fhir/deploy', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fhirUrl: baseUrl,
                    resource: libraryJson
                })
            });

            if (!libResponse.ok) console.warn("Library deployment warning:", await libResponse.text());

            // 4. Deploy Measure
            const response = await fetch('/api/fhir/deploy', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fhirUrl: baseUrl,
                    resource: measureJson
                })
            });

            const result = await response.json();

            if (response.ok) {
                alert(`部署成功！ (Measure + Library)`);
                // Auto-verify after success
                setVerifyResult(JSON.stringify(result, null, 2));
            } else {
                console.error("Deploy Error Result:", result);
                alert(`部署失敗: ${result.error || response.statusText}\nTarget: ${baseUrl}\nDetails: ${JSON.stringify(result.details)}`);
                setVerifyResult(JSON.stringify(result, null, 2));
            }
        } catch (error) {
            console.error('Deploy error:', error);
            alert(`部署發生錯誤: ${String(error)}`);
        }
    };

    const runEvaluation = async () => {
        setVerifyResult("Running Evaluation...");
        const currentFhirUrl = getFreshUrl();
        try {
            const baseUrl = currentFhirUrl.replace(/\/$/, '');

            const response = await fetch('/api/fhir/evaluate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fhirUrl: baseUrl, // ... use baseUrl ...
                    measureId: measure.id,
                    periodStart: evalParams.periodStart,
                    periodEnd: evalParams.periodEnd,
                    patientId: evalParams.patientId
                })
            });
            // ... rest of logic
            const result = await response.json();

            if (response.ok) {
                setVerifyResult(JSON.stringify(result, null, 2));
            } else {
                setVerifyResult(`Evaluation Failed: ${result.error} \nDetails: ${JSON.stringify(result.details, null, 2)} `);
            }

        } catch (error) {
            setVerifyResult(`Execution Error: ${String(error)} `);
        }
    };

    const verifyDeployment = async () => {
        const currentFhirUrl = getFreshUrl();
        const baseUrl = currentFhirUrl.replace(/\/$/, '');
        const targetUrl = `${baseUrl}/Measure/${measure.id}`;

        try {
            setVerifyResult(`Verifying via ${targetUrl} ...`);

            // Use Proxy to avoid CORS and handle HTML errors gracefully
            const response = await fetch('/api/fhir/read', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fhirUrl: baseUrl,
                    path: `Measure/${measure.id}`
                })
            });
            // ... rest of logic
            const data = await response.json();

            if (response.ok) {
                setVerifyResult(`[URL Used]: ${targetUrl} \n\n` + JSON.stringify(data, null, 2));
            } else {
                setVerifyResult(
                    `[Error]: ${data.error} \n` +
                    `[URL Used]: ${data.urlUsed || targetUrl} \n` +
                    (data.preview ? `[Preview]: ${data.preview} ` : `[Details]: ${JSON.stringify(data.details, null, 2)} `)
                );
            }
        } catch (e) {
            setVerifyResult(`Client Error: ${String(e)} \nTarget: ${targetUrl} `);
        }
    };

    const downloadJson = () => {
        const measureJson = {
            resourceType: 'Measure',
            id: measure.id,
            title: measure.title,
            // ... comprehensive structure would go here
            note: "Generated by KPIM Measure Builder"
        };
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(measureJson, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", measure.id + ".json");
        document.body.appendChild(downloadAnchorNode); // required for firefox
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    };

    return (
        <div className="flex flex-col gap-4">
            {/* Info Bar */}
            <div className="flex items-center gap-2 text-xs text-gray-500 px-1">
                <span className="font-semibold">Target Server:</span>
                <span className="font-mono bg-gray-100 px-1 rounded">{fhirUrl}</span>
                <span className="text-gray-400">(Managed in Settings)</span>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-4 flex-wrap items-start">
                <button
                    className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition flex items-center gap-2 shadow-sm"
                    onClick={deployToFHIR}
                >
                    <span>🚀</span> 部署到 FHIR Server
                </button>
                <button
                    className="bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-indigo-700 transition flex items-center gap-2 shadow-sm"
                    onClick={verifyDeployment}
                >
                    <span>🔍</span> 驗證部署 (Check)
                </button>
                <button
                    className={`px-6 py-3 rounded-lg transition flex items-center gap-2 shadow-sm text-white ${showEvalForm ? 'bg-purple-700 ring-2 ring-purple-300' : 'bg-purple-600 hover:bg-purple-700'}`}
                    onClick={() => setShowEvalForm(!showEvalForm)}
                >
                    <span>📊</span> 執行計算 (Evaluate)
                </button>
                <button
                    className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition flex items-center gap-2 shadow-sm"
                    onClick={downloadJson}
                >
                    <span>💾</span> 下載 JSON 檔案
                </button>
            </div>

            {/* Evaluation Form */}
            {showEvalForm && (
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 max-w-2xl animate-in fade-in slide-in-from-top-2">
                    <h4 className="font-semibold text-purple-900 mb-3">執行參數設定 ($evaluate-measure)</h4>
                    <div className="grid grid-cols-2 gap-4 mb-4">
                        <div>
                            <label className="block text-xs font-medium text-purple-700 mb-1">開始日期 (Start)</label>
                            <input
                                type="date"
                                value={evalParams.periodStart}
                                onChange={e => setEvalParams({ ...evalParams, periodStart: e.target.value })}
                                className="w-full p-2 border rounded"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-purple-700 mb-1">結束日期 (End)</label>
                            <input
                                type="date"
                                value={evalParams.periodEnd}
                                onChange={e => setEvalParams({ ...evalParams, periodEnd: e.target.value })}
                                className="w-full p-2 border rounded"
                            />
                        </div>
                        <div className="col-span-2">
                            <label className="block text-xs font-medium text-purple-700 mb-1">受試者 ID (Subject, optional)</label>
                            <input
                                type="text"
                                value={evalParams.patientId}
                                onChange={e => setEvalParams({ ...evalParams, patientId: e.target.value })}
                                className="w-full p-2 border rounded"
                                placeholder="e.g. Patient/Patient-Test-001"
                            />
                        </div>
                    </div>
                    <button
                        onClick={runEvaluation}
                        className="w-full bg-purple-600 text-white py-2 rounded hover:bg-purple-700 font-medium"
                    >
                        確認執行 (Run)
                    </button>
                </div>
            )}

            {/* Verification Result Area */}
            {verifyResult && (
                <div className="mt-4 border rounded-lg p-4 bg-slate-800 text-slate-200 shadow-inner">
                    <div className="flex justify-between items-center mb-2">
                        <h4 className="text-sm font-bold text-slate-400 uppercase">Server Response / Verification</h4>
                        <button onClick={() => setVerifyResult(null)} className="text-xs text-slate-500 hover:text-white">Clear</button>
                    </div>
                    <pre className="text-xs font-mono overflow-auto max-h-60 whitespace-pre-wrap">
                        {verifyResult}
                    </pre>
                </div>
            )}
        </div>
    );
}
