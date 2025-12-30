"use client";
import { useState } from 'react';
import { MeasureHeader } from '@/components/measure-builder/MeasureHeader';
import { MeasurePopulation } from '@/components/measure-builder/MeasurePopulation';
import { CQLPreview } from '@/components/measure-builder/CQLPreview';
import { DeployButtons } from '@/components/measure-builder/DeployButtons';

export default function MeasureBuilder() {
    const [measure, setMeasure] = useState({
        id: 'measure-proph-abx-1h',
        title: '預防性抗生素劃刀前1小時內給予比率',
        denominator: { expression: '', resources: [], conditions: [] },
        numerator: { expression: '', resources: [], conditions: [] },
        exclusions: { expression: '', resources: [], conditions: [] }
    });

    return (
        <div className="p-8 max-w-7xl mx-auto bg-gray-50 min-h-screen">
            <h1 className="text-3xl font-bold mb-8 text-gray-900">指標公式建構器</h1>

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

            {/* CQL 預覽與生成 */}
            <CQLPreview measure={measure} />

            {/* 一鍵部署 */}
            <DeployButtons measure={measure} />
        </div>
    );
}
