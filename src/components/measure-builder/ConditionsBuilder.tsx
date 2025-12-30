import React from 'react';

interface Condition {
    label: string;
    fhirPath: string;
    valueSet: string;
}

interface ConditionRowProps {
    condition: Condition;
    templates: Condition[];
    onUpdate: (condition: Condition) => void;
    onDelete: () => void;
}

function ConditionRow({ condition, templates, onUpdate, onDelete }: ConditionRowProps) {
    return (
        <div className="flex bg-gray-50 p-2 rounded items-center gap-2 mb-2 border">
            <div className="grid grid-cols-3 gap-2 flex-grow">
                <input
                    list="templates-label"
                    placeholder="條件名稱"
                    className="w-full text-sm p-1 border rounded"
                    value={condition.label}
                    onChange={(e) => {
                        const val = e.target.value;
                        const template = templates.find(t => t.label === val);
                        if (template) {
                            onUpdate(template);
                        } else {
                            onUpdate({ ...condition, label: val });
                        }
                    }}
                />
                <datalist id="templates-label">
                    {templates.map((t, i) => <option key={i} value={t.label} />)}
                </datalist>

                <input
                    placeholder="FHIR Path"
                    className="w-full text-sm p-1 border rounded"
                    value={condition.fhirPath}
                    onChange={(e) => onUpdate({ ...condition, fhirPath: e.target.value })}
                />
                <input
                    placeholder="ValueSet / Code"
                    className="w-full text-sm p-1 border rounded"
                    value={condition.valueSet}
                    onChange={(e) => onUpdate({ ...condition, valueSet: e.target.value })}
                />
            </div>
            <button
                onClick={onDelete}
                className="text-red-500 hover:text-red-700 px-2"
                aria-label="Delete condition"
            >
                ×
            </button>
        </div>
    );
}

export function ConditionsBuilder({ conditions, onChange }: any) {
    const conditionTemplates = [
        { label: 'ICD-10-PCS 手術碼', fhirPath: 'Procedure.code', valueSet: 'ICD10PCS-00.30-86.99' },
        { label: 'ASA 分級', fhirPath: 'Observation.code=ASA', valueSet: 'TW-ASA' },
        { label: '手術室位置', fhirPath: 'Procedure.location', valueSet: 'TW-OR-LOCATION' },
        { label: '劃刀前60分', fhirPath: 'MedicationAdministration.effective 60m before Procedure.start', valueSet: '' },
        { label: '預防性抗生素', fhirPath: 'MedicationAdministration.category=prophylactic', valueSet: 'ATC-J01-PPX' },
        { label: '排除剖腹產', fhirPath: 'not Procedure.code in CesareanSection', valueSet: 'C-SECTION' }
    ];

    return (
        <div>
            <label className="block text-sm font-medium mb-2">條件定義</label>
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {conditions.map((condition: any, index: number) => (
                    <ConditionRow
                        key={index}
                        condition={condition}
                        templates={conditionTemplates}
                        onUpdate={(updated) => {
                            const newConditions = [...conditions];
                            newConditions[index] = updated;
                            onChange(newConditions);
                        }}
                        onDelete={() => {
                            const newConditions = conditions.filter((_: any, i: number) => i !== index);
                            onChange(newConditions);
                        }}
                    />
                ))}
                <button
                    className="text-blue-500 hover:text-blue-700 text-sm font-medium"
                    onClick={() => onChange([...conditions, { label: '', fhirPath: '', valueSet: '' }])}
                >
                    + 新增條件
                </button>
            </div>
        </div>
    );
}
