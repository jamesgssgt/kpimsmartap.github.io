import React from 'react';

export function CQLPreview({ measure }: { measure: any }) {
    const generateCQL = () => {
        // Helper to join resources
        const getResourcesCQL = (resources: string[] = []) =>
            resources.map(r => `[${r}]`).join(' ');

        // Helper to join conditions
        const getConditionsCQL = (conditions: any[] = []) => {
            if (!conditions || conditions.length === 0) return '';
            const condStrings = conditions
                .filter((c: any) => c.fhirPath)
                .map((c: any) => c.fhirPath);

            if (condStrings.length === 0) return '';
            return 'where ' + condStrings.join(' \n    and ');
        };

        // Construct Denominator logic
        const denomResources = getResourcesCQL(measure.denominator.resources);
        const denomConditions = getConditionsCQL(measure.denominator.conditions);
        const denomCQL = `${denomResources} \n  ${denomConditions}`;

        // Construct Numerator logic
        // Numerator typically references Denominator subset
        const numResources = getResourcesCQL(measure.numerator.resources); // Usually empty if referencing Denominator

        // The snippet used: "Denominator" P where ...
        // But also had logic for resources in the snippet generator if present.
        // The snippet logic:
        // const numCQL = measure.numerator.resources.map(r => `[${r}]`).join(' ') + 
        //               measure.numerator.conditions.map(c => `where ${c.fhirPath}`).join(' and ');

        // Implementation based on snippet but slightly formatted
        const numConditions = measure.numerator.conditions && measure.numerator.conditions.length > 0
            ? `where ${measure.numerator.conditions.map((c: any) => c.fhirPath).join(' and ')}`
            : '';

        return `
library ${measure.id ? measure.id.replace(/-/g, '_') : 'Measure'}CQL

define "Denominator":
  ${denomCQL}

define "Numerator":
  "Denominator" P
  ${numConditions}

define "${measure.title}":
  Count("Numerator") / Count("Denominator") * 100 '%'
    `;
    };

    return (
        <div className="border rounded-lg p-6 mb-8 bg-white shadow-sm">
            <h3 className="text-lg font-semibold mb-4">CQL 即時預覽</h3>
            <pre className="bg-gray-900 text-green-400 p-4 rounded text-xs overflow-auto max-h-96 font-mono whitespace-pre-wrap">
                {generateCQL()}
            </pre>
            <div className="mt-4 text-sm text-gray-600">
                FHIR Measure ID: <code className="bg-gray-100 px-1 py-0.5 rounded">{measure.id}</code>
            </div>
        </div>
    );
}
