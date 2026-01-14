import React from 'react';

export function RulePreview({ measure }: { measure: any }) {
    const generateRuleStructure = () => {
        // Transform the UI state into a structured rule object
        // This represents the "Concept" of the logic without using CQL Syntax
        const rules = {
            measureId: measure.id,
            description: measure.title,
            populations: {
                denominator: {
                    description: "分母 (Denominator)",
                    criteria: {
                        resources: measure.denominator.resources,
                        filters: measure.denominator.conditions.map((c: any) => ({
                            description: c.label,
                            path: c.fhirPath,
                            valueSet: c.valueSet
                        }))
                    }
                },
                numerator: {
                    description: "分子 (Numerator)",
                    criteria: {
                        // Numerator usually implies Denominator + Extra constraints
                        includedPopulation: "Denominator",
                        resources: measure.numerator.resources,
                        filters: measure.numerator.conditions.map((c: any) => ({
                            description: c.label,
                            path: c.fhirPath,
                            valueSet: c.valueSet
                        }))
                    }
                },
                exclusions: {
                    description: "排除條件 (Exclusions)",
                    criteria: {
                        filters: measure.exclusions.conditions.map((c: any) => ({
                            description: c.label,
                            path: c.fhirPath,
                            valueSet: c.valueSet
                        }))
                    }
                }
            }
        };

        return JSON.stringify(rules, null, 2);
    };

    return (
        <div className="border rounded-lg p-6 mb-8 bg-white shadow-sm">
            <h3 className="text-lg font-semibold mb-4">規則結構預覽 (Structured Logic)</h3>
            <div className="bg-gray-900 text-blue-300 p-4 rounded text-xs overflow-auto max-h-96 font-mono whitespace-pre-wrap">
                {generateRuleStructure()}
            </div>
            <div className="mt-4 text-sm text-gray-600">
                此結構將用於查找對應的臨床數據內容，不依賴特定 CQL 語法。
            </div>
        </div>
    );
}
