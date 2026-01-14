"use client";

import React, { useState, useEffect } from 'react';
import { Factor, FactorStep, CalculationStep, QualityIndicator } from '@/components/indicator/types';
import { saveFactor, getFactors } from '@/app/actions/kift';
import { useRouter } from 'next/navigation';
import { Loader2, X, Plus, ChevronDown, Wand2, Brain, Check, Info, Trash2 } from 'lucide-react';
import { CriterionRow } from '@/components/indicator/CriterionRow';
import { useSettings } from '@/contexts/SettingsContext';

interface Props {
    initialData?: Factor | null;
    onCancel: () => void;
    onDelete?: () => void;
    availableIndicators?: QualityIndicator[];
}

export function FactorForm({ initialData, onCancel, onDelete, availableIndicators = [] }: Props) {
    const router = useRouter();
    const { enableAi } = useSettings();

    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [method, setMethod] = useState<'sum' | 'count' | 'distcount'>('sum');
    const [sourceType, setSourceType] = useState<'FHIR' | 'Manual'>('FHIR'); // Default to FHIR
    const [steps, setSteps] = useState<CalculationStep[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [saveAttempted, setSaveAttempted] = useState(false);
    const [availableFactors, setAvailableFactors] = useState<Factor[]>([]);

    useEffect(() => {
        getFactors().then(setAvailableFactors).catch(console.error);
    }, []);

    // AI Draft
    const [draft, setDraft] = useState('');
    const [isAiLoading, setIsAiLoading] = useState(false);

    useEffect(() => {
        if (initialData) {
            setName(initialData.name);
            setDescription(initialData.description);
            setMethod(initialData.method);
            setSourceType(initialData.sourceType);
            setSteps(initialData.steps);
        }
    }, [initialData]);

    const handleAddStep = () => {
        const newStep: CalculationStep = {
            id: Math.random().toString(36).substr(2, 9),
            action: steps.length === 0 ? 'BASE' : 'AND',
            valueType: 'fhir_filter',
            resourceType: 'Observation',
            path: '',
            operator: 'equals',
            value: '',
            notes: ''
        };
        setSteps([...steps, newStep]);
    };

    const handleSave = async () => {
        setSaveAttempted(true);
        if (!name.trim()) return;

        setIsSaving(true);
        try {
            const factor: Factor = {
                id: initialData?.id || '',
                name,
                description,
                method,
                sourceType,
                steps
            };
            await saveFactor(factor);
            onCancel(); // Use the passed onCancel which should handle redirect
        } catch (error) {
            console.error('Failed to save factor:', error);
            alert('儲存失敗，請重試');
        } finally {
            setIsSaving(false);
        }
    };

    // AI Logic (simplified placeholder for now, similar to IndicatorForm)
    const handleSmartAnalyze = async () => {
        if (!draft.trim()) return;
        setIsAiLoading(true);
        // Simulate AI delay
        await new Promise(resolve => setTimeout(resolve, 1500));
        setIsAiLoading(false);
        // Would integrate actual AI service here
    };

    return (
        <div className="bg-white p-6 md:p-8 rounded-[2.5rem] border-2 border-slate-100 shadow-2xl relative pb-32 w-full animate-in fade-in slide-in-from-bottom-8 duration-500">
            <div className="absolute top-0 left-0 w-full h-4 bg-emerald-500"></div>

            {/* Header */}
            <div className="flex items-center justify-between mb-8 pt-4">
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-white shadow-lg bg-emerald-500">
                        <Check size={32} />
                    </div>
                    <div>
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-1">
                            {initialData ? '編輯要素 (Edit Factor)' : '新增要素 (New Factor)'}
                        </span>
                        <h2 className="font-black text-3xl text-slate-900 tracking-tight">要素定義</h2>
                    </div>
                </div>
                <button onClick={onCancel} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400">
                    <X size={24} />
                </button>
            </div>

            {/* Fields Block */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8 bg-slate-50 p-6 rounded-3xl border border-slate-100">
                <div className="space-y-3">
                    <label className="text-sm font-black text-slate-500 uppercase tracking-widest ml-1">名稱 (Name) <span className="text-rose-500">*</span></label>
                    <div className="relative">
                        <input
                            type="text"
                            className={`w-full bg-white border-2 rounded-xl px-4 py-4 font-bold text-lg text-slate-700 outline-none transition-all ${saveAttempted && !name.trim() ? 'border-rose-400 ring-4 ring-rose-50' : 'border-slate-200 focus:border-indigo-600 focus:ring-4 focus:ring-indigo-50'}`}
                            placeholder="輸入要素名稱..."
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                        />
                        {saveAttempted && !name.trim() && (
                            <div className="absolute -bottom-6 left-2 text-rose-500 text-[10px] font-bold animate-in slide-in-from-top-1">
                                必填欄位
                            </div>
                        )}
                    </div>
                </div>

                <div className="space-y-3">
                    <label className="text-sm font-black text-slate-500 uppercase tracking-widest ml-1">計算方式 (Calculation Method)</label>
                    <div className="relative">
                        <select
                            className="w-full bg-white border-2 rounded-xl px-4 py-4 font-bold text-lg text-slate-700 outline-none border-slate-200 focus:border-indigo-600 focus:ring-4 focus:ring-indigo-50 appearance-none cursor-pointer"
                            value={method}
                            onChange={(e) => setMethod(e.target.value as any)}
                        >
                            <option value="sum">加總 (Sum)</option>
                            <option value="count">計數 (Count)</option>
                            <option value="distcount">不重複計數 (Distinct Count)</option>
                        </select>
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                            <ChevronDown size={20} />
                        </div>
                    </div>
                </div>
            </div>

            {/* Description Block */}
            <div className="mb-8 space-y-3">
                <div className="flex justify-between items-center px-1">
                    <label className="text-sm font-black text-slate-500 uppercase tracking-widest ml-1">描述邏輯說明 (Description)</label>
                    {enableAi && (
                        <div className="flex items-center gap-2 bg-indigo-50 px-3 py-1 rounded-lg border border-indigo-100">
                            <Wand2 size={12} className="text-indigo-600" />
                            <span className="text-[10px] font-black text-indigo-600 uppercase">AI 輔助</span>
                        </div>
                    )}
                </div>
                <div className="flex gap-4">
                    <textarea
                        className="flex-1 bg-white rounded-2xl p-6 text-base font-bold border-2 border-slate-100 focus:border-indigo-500 outline-none h-32 shadow-sm resize-none transition-all placeholder:text-slate-300"
                        placeholder="請描述此要素的計算邏輯與定義..."
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                    />
                    {enableAi && (
                        <button type="button" onClick={handleSmartAnalyze} disabled={isAiLoading || !description.trim()} className="px-6 bg-slate-900 text-white rounded-2xl font-black text-sm shadow-xl hover:bg-slate-800 transition disabled:opacity-50 flex flex-col items-center justify-center gap-2 group min-w-[140px]">
                            {isAiLoading ? <Loader2 className="animate-spin" /> : <Brain size={24} className="group-hover:scale-110 transition-transform" />}
                            智慧建議
                        </button>
                    )}
                </div>
            </div>

            {/* Steps Block */}
            <div className="mb-12 space-y-4">
                <label className="text-sm font-black text-slate-500 uppercase tracking-widest ml-1 mb-2 block">運算步驟 (Calculation Steps)</label>
                {steps.length === 0 ? (
                    <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl p-12 text-center text-slate-400 font-bold">
                        尚無運算步驟，請點擊下方按鈕新增
                    </div>
                ) : (
                    <div className="space-y-4">
                        {steps.map((s, idx) => (
                            <CriterionRow
                                key={s.id}
                                step={s}
                                availableIndicators={availableIndicators}
                                availableFactors={availableFactors.filter(f => !initialData || f.id !== initialData.id)} // Exclude self
                                sectionKey="num" // Reuse num style generally
                                onRemove={() => setSteps(steps.filter(x => x.id !== s.id))}
                                onUpdate={(u: Partial<CalculationStep>) => setSteps(steps.map(x => x.id === s.id ? { ...x, ...u } : x))}
                                indicatorContext={{ name: name, description: description }}
                            />
                        ))}
                    </div>
                )}

                <button type="button" onClick={handleAddStep} className="w-full py-6 border-2 border-dashed border-slate-200 rounded-2xl text-slate-400 font-black hover:bg-white hover:border-indigo-300 hover:text-indigo-500 flex items-center justify-center gap-3 transition-all group text-base shadow-inner bg-slate-50/50">
                    <Plus size={20} className="group-hover:rotate-90 transition-transform" /> 手動新增運算步驟
                </button>
            </div>

            {/* Footer */}
            <div className="mt-12 pt-8 border-t border-slate-100 flex justify-end gap-6">
                {initialData && onDelete && (
                    <button
                        type="button"
                        onClick={onDelete}
                        className="px-8 py-4 text-rose-400 hover:text-rose-600 font-bold text-lg transition-colors mr-auto flex items-center gap-2"
                    >
                        <Trash2 size={20} />
                        刪除要素
                    </button>
                )}
                <button type="button" onClick={onCancel} className="px-8 py-4 text-slate-400 hover:text-slate-800 font-black text-lg transition-colors">取消</button>
                <button
                    type="button"
                    onClick={handleSave}
                    disabled={isSaving}
                    className="px-12 py-4 bg-slate-900 text-white rounded-2xl font-black hover:bg-emerald-600 shadow-xl transition-all text-xl active:scale-95 disabled:opacity-70 disabled:pointer-events-none flex items-center gap-3"
                >
                    {isSaving && <Loader2 className="animate-spin" size={20} />}
                    儲存要素
                </button>
            </div>
        </div>
    );
}
