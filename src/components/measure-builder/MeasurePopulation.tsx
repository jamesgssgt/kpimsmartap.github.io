import React from 'react';
import { ConditionsBuilder } from './ConditionsBuilder';

interface MeasurePopulationProps {
    title: string;
    type: 'denominator' | 'numerator' | 'denominator-exclusion';
    population: any;
    onChange: (population: any) => void;
}

export function MeasurePopulation({ title, type, population, onChange }: MeasurePopulationProps) {
    return (
        <div className="border rounded-lg p-6 shadow-sm bg-white">
            <h3 className="text-xl font-semibold mb-4 text-blue-600">{title}</h3>

            {/* FHIR Resource 選擇 */}
            <div className="mb-4">
                <label className="block text-sm font-medium mb-2">FHIR 資源</label>
                <select
                    multiple
                    className="w-full p-2 border rounded-md min-h-[120px]"
                    value={population.resources || []}
                    onChange={(e) => onChange({
                        ...population,
                        resources: Array.from(e.target.selectedOptions, option => option.value)
                    })}
                >
                    <option value="Encounter">Encounter (就診事件)</option>
                    <option value="Procedure">Procedure (手術)</option>
                    <option value="Observation">Observation (觀察)</option>
                    <option value="MedicationAdministration">MedicationAdministration (給藥)</option>
                    <option value="Patient">Patient (病患)</option>
                    <option value="Condition">Condition (診斷)</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">按住 Ctrl/Cmd 可多選</p>
            </div>

            {/* 條件建構器 */}
            <ConditionsBuilder
                conditions={population.conditions || []}
                onChange={(conditions: any) => onChange({ ...population, conditions })}
            />

            {/* CQL 語法提示 */}
            <div className="mt-4 p-3 bg-gray-50 rounded border border-gray-100">
                <code className="text-sm text-green-700 block break-all">
                    CQL 範例: [{(population.resources && population.resources[0]) || 'Resource'}: {type === 'denominator' ? 'surgery' : 'antibiotic-1h'}]
                </code>
            </div>
        </div>
    );
}
