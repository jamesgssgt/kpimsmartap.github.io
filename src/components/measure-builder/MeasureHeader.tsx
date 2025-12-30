import React from 'react';

interface MeasureHeaderProps {
    measure: {
        id: string;
        title: string;
        [key: string]: any;
    };
    onChange: (updates: any) => void;
}

export function MeasureHeader({ measure, onChange }: MeasureHeaderProps) {
    return (
        <div className="bg-white p-6 rounded-lg shadow-sm border mb-8">
            <h2 className="text-xl font-semibold mb-4 text-gray-800">基本資訊</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Measure ID
                    </label>
                    <input
                        type="text"
                        className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                        value={measure.id}
                        onChange={(e) => onChange({ ...measure, id: e.target.value })}
                        placeholder="e.g. measure-proph-abx-1h"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        指標名稱 (Title)
                    </label>
                    <input
                        type="text"
                        className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                        value={measure.title}
                        onChange={(e) => onChange({ ...measure, title: e.target.value })}
                        placeholder="e.g. 預防性抗生素劃刀前1小時內給予比率"
                    />
                </div>
            </div>
        </div>
    );
}
