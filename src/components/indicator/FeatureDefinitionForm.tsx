"use client";

import React, { useState, useEffect } from 'react';
import { Table, Save, ArrowLeft, Loader2, Trash2, Plus } from 'lucide-react';
import { RESOURCE_CONFIG } from '@/components/indicator/resource-config';
import { useRouter } from 'next/navigation';
import { FeatureColumnDef, saveFeatureDefinitions, getFeatureDefinitions } from '@/app/actions/save-features';
import { SearchableDropdown } from '@/components/indicator/SearchableDropdown';

interface Props {
    kpiId: string;
    kpiName: string;
}

export const FeatureDefinitionForm: React.FC<Props> = ({ kpiId, kpiName }) => {
    const router = useRouter();
    const [features, setFeatures] = useState<FeatureColumnDef[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        loadData();
    }, [kpiId]);

    const loadData = async () => {
        setLoading(true);
        try {
            const data = await getFeatureDefinitions(kpiId);
            if (data && data.length > 0) {
                setFeatures(data);
            } else {
                // Initialize default 7 slots
                setFeatures(Array.from({ length: 7 }, (_, i) => ({
                    slot: `column${i + 1}`,
                    displayName: '',
                    fhirSource: '',
                    seq: i + 1
                })));
            }
        } catch (e) {
            console.error(e);
            alert("載入失敗");
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            // Filter empty? Maybe not, keep slots to preserve order if needed, or filter empty display/source
            const toSave = features.filter(f => f.displayName.trim() || f.fhirSource.trim());

            const res = await saveFeatureDefinitions(kpiId, toSave);
            if (res.success) {
                alert("儲存成功！");
                router.refresh(); // Refresh current route?
            } else {
                alert("儲存失敗: " + res.message);
            }
        } catch (e) {
            alert("錯誤");
        } finally {
            setSaving(false);
        }
    };

    const fhirOptions = React.useMemo(() => {
        const options: { value: string; label: string }[] = [];
        Object.entries(RESOURCE_CONFIG).forEach(([resourceType, config]) => {
            config.paths.forEach(p => {
                const fullPath = `${resourceType}.${p.value}`;
                options.push({
                    value: fullPath,
                    label: `${config.label.split(' ')[0]} - ${p.label} (${fullPath})`
                });
            });
        });
        return options;
    }, []);

    if (loading) return <div className="p-10 flex justify-center"><Loader2 className="animate-spin text-slate-400" /></div>;

    return (
        <div className="bg-white p-6 md:p-12 rounded-[2.5rem] shadow-xl border border-slate-100 max-w-5xl mx-auto my-10 animate-in fade-in slide-in-from-bottom-4">
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                    <button onClick={() => router.back()} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400 hover:text-slate-600">
                        <ArrowLeft size={24} />
                    </button>
                    <div>
                        <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                            <Table className="text-indigo-600" />
                            明細欄位定義
                        </h1>
                        <p className="text-slate-500 font-bold mt-1">
                            設定 <span className="text-indigo-600">[{kpiName}]</span> 的明細表顯示欄位與 FHIR 路徑
                        </p>
                    </div>
                </div>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 px-8 py-4 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-800 transition-all active:scale-95 disabled:opacity-50"
                >
                    {saving ? <Loader2 className="animate-spin" /> : <Save size={20} />}
                    儲存設定
                </button>
            </div>

            <div className="bg-slate-50/50 rounded-3xl border border-slate-200 overflow-hidden">


                <table className="w-full text-left">
                    <thead className="bg-slate-100/50 border-b border-slate-200">
                        <tr>
                            <th className="py-5 px-8 text-xs font-black text-slate-400 uppercase tracking-widest w-32">Slot</th>
                            <th className="py-5 px-8 text-xs font-black text-slate-400 uppercase tracking-widest w-1/3">顯示名稱 (Display Name)</th>
                            <th className="py-5 px-8 text-xs font-black text-slate-400 uppercase tracking-widest">資料來源路徑 (FHIR Source Path)</th>
                            <th className="py-5 px-4 w-16"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {features.map((col, idx) => (
                            <tr key={idx} className="group hover:bg-white transition-colors">
                                <td className="py-4 px-8 font-mono font-bold text-slate-400 text-sm">
                                    {col.slot}
                                </td>
                                <td className="py-4 px-8">
                                    <input
                                        type="text"
                                        className="w-full bg-transparent border-2 border-transparent focus:border-indigo-100 focus:bg-white outline-none font-bold text-slate-700 placeholder:text-slate-300 transition-all rounded-xl px-4 py-3"
                                        placeholder="未設定"
                                        value={col.displayName}
                                        onChange={(e) => {
                                            const newCols = [...features];
                                            newCols[idx].displayName = e.target.value;
                                            setFeatures(newCols);
                                        }}
                                    />
                                </td>
                                <td className="py-4 px-8">
                                    <SearchableDropdown
                                        label=""
                                        placeholder="未設定 (e.g. Patient.identifier.value)"
                                        value={col.fhirSource}
                                        onChange={(val) => {
                                            const newCols = [...features];
                                            newCols[idx].fhirSource = val;
                                            setFeatures(newCols);
                                        }}
                                        options={fhirOptions}
                                        renderSelected={(opt) => opt.value}
                                    />
                                </td>
                                <td className="py-4 px-4 text-center">
                                    <button
                                        onClick={() => {
                                            const newCols = features.filter((_, i) => i !== idx);
                                            setFeatures(newCols);
                                        }}
                                        className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                                        title="刪除"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                <button
                    onClick={() => {
                        const lastSlot = features.length > 0 ? features[features.length - 1].slot : 'column0';
                        const lastNum = parseInt(lastSlot.replace('column', '')) || features.length;
                        const nextNum = lastNum + 1;
                        setFeatures([...features, {
                            slot: `column${nextNum}`,
                            displayName: '',
                            fhirSource: '',
                            seq: features.length + 1
                        }]);
                    }}
                    className="w-full py-4 text-center text-sm font-black text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors border-t border-slate-100 flex items-center justify-center gap-2"
                >
                    <Plus size={16} />
                    新增欄位
                </button>
            </div>

            <div className="mt-8 flex justify-end">
                <p className="text-xs text-slate-400 font-bold px-4">
                    提示: 至少填寫顯示名稱與路徑才能生效。
                </p>
            </div>
        </div>
    );
};
