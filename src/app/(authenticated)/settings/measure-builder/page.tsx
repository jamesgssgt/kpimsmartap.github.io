"use client";
import { useState } from 'react';
import { MeasureHeader } from '@/components/measure-builder/MeasureHeader';
import { MeasurePopulation } from '@/components/measure-builder/MeasurePopulation';
import { RulePreview } from '@/components/measure-builder/RulePreview';
import { DeployButtons } from '@/components/measure-builder/DeployButtons';

interface Population {
    expression: string;
    resources: string[];
    conditions: { label: string; fhirPath: string; valueSet: string }[];
}

interface Measure {
    id: string;
    title: string;
    denominator: Population;
    numerator: Population;
    exclusions: Population;
}

export default function MeasureBuilder() {
    const [measure, setMeasure] = useState<Measure>({
        id: 'measure-proph-abx-1h',
        title: '預防性抗生素劃刀前1小時內給予比率',
        denominator: { expression: '', resources: [], conditions: [] },
        numerator: { expression: '', resources: [], conditions: [] },
        exclusions: { expression: '', resources: [], conditions: [] }
    });

    const examples = [
        {
            id: 'measure-proph-abx-1h',
            title: '預防性抗生素劃刀前1小時內給予比率',
            denominator: {
                expression: '',
                resources: ['Procedure', 'Observation', 'MedicationAdministration'],
                conditions: [
                    { label: 'ICD-10-PCS 手術碼', fhirPath: 'Procedure.code', valueSet: 'ICD10PCS-00.30-86.99' },
                    { label: 'ASA 分級', fhirPath: 'Observation.code=ASA', valueSet: 'TW-ASA' },
                    { label: '手術室位置', fhirPath: 'Procedure.location', valueSet: 'TW-OR-LOCATION' },
                    { label: '有預防性抗生素', fhirPath: 'MedicationAdministration.category=prophylactic', valueSet: 'ATC-J01-PPX' }
                ]
            },
            numerator: {
                expression: '',
                resources: ['MedicationAdministration'],
                conditions: [
                    { label: '劃刀前60分', fhirPath: 'MedicationAdministration.effective 60m before Procedure.start', valueSet: '' }
                ]
            },
            exclusions: {
                expression: '',
                resources: [],
                conditions: [
                    { label: '排除剖腹產', fhirPath: 'not Procedure.code in CesareanSection', valueSet: 'C-SECTION' }
                ]
            }
        },
        {
            id: 'measure-sugar-control',
            title: '糖尿病患者糖化血色素控制 < 7%',
            denominator: {
                expression: '',
                resources: ['Patient', 'Condition'],
                conditions: [
                    { label: '診斷為糖尿病', fhirPath: 'Condition.code', valueSet: 'Diabetes-Mellitus' },
                    { label: '年齡 18-75', fhirPath: 'age >= 18 and age <= 75', valueSet: '' }
                ]
            },
            numerator: {
                expression: '',
                resources: ['Observation'],
                conditions: [
                    { label: 'HbA1c < 7%', fhirPath: 'Observation.code=HbA1c and Observation.valueQuantity < 7', valueSet: 'LOINC-4548-4' }
                ]
            },
            exclusions: { expression: '', resources: [], conditions: [] }
        }
    ];

    const loadExample = (idx: number) => {
        setMeasure({ ...measure, ...examples[idx] });
    };

    return (
        <div className="p-8 max-w-7xl mx-auto bg-gray-50 min-h-screen">
            <div className="flex justify-between items-center mb-8">
                <h1 className="text-3xl font-bold text-gray-900">指標公式建構器</h1>
                <div className="flex gap-2">
                    <span className="text-sm self-center text-gray-500 mr-2">載入範例:</span>
                    {examples.map((ex, i) => (
                        <button
                            key={i}
                            onClick={() => loadExample(i)}
                            className="px-3 py-1 text-sm bg-white border border-gray-300 rounded hover:bg-gray-50 text-blue-600"
                        >
                            {ex.title.substring(0, 10)}...
                        </button>
                    ))}
                </div>
            </div>

            {/* 基本資訊 */}
            <MeasureHeader measure={measure} onChange={(updates) => setMeasure({ ...measure, ...updates })} />

            {/* 分子分母定義區 */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
                <MeasurePopulation
                    title="分母 (Denominator)"
                    type="denominator"
                    population={measure.denominator}
                    onChange={(p) => setMeasure({ ...measure, denominator: p })}
                />
                <MeasurePopulation
                    title="分子 (Numerator)"
                    type="numerator"
                    population={measure.numerator}
                    onChange={(p) => setMeasure({ ...measure, numerator: p })}
                />
                <MeasurePopulation
                    title="排除 (Exclusions)"
                    type="denominator-exclusion"
                    population={measure.exclusions}
                    onChange={(p) => setMeasure({ ...measure, exclusions: p })}
                />
            </div>

            {/* 規則結構預覽 */}
            <RulePreview measure={measure} />

            {/* 一鍵部署 */}
            <DeployButtons measure={measure} />
        </div>
    );
}
