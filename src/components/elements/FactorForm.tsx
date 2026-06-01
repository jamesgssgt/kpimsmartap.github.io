"use client";

import React, { useState, useEffect } from 'react';
import { Factor, FactorStep, CalculationStep, QualityIndicator } from '@/components/indicator/types';
import { saveFactor, getFactors } from '@/app/actions/kift';
import { analyzeSectionDefinition } from '@/app/actions/ai';
import { useRouter } from 'next/navigation';
import { Loader2, X, Plus, ChevronDown, Wand2, Brain, Check, Info, Trash2, Code, Copy } from 'lucide-react';
import { CriterionRow } from '@/components/indicator/CriterionRow';
import { useSettings } from '@/contexts/SettingsContext';

const highlightJson = (jsonStr: string) => {
    return jsonStr.replace(
        /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g,
        (match) => {
            let cls = 'text-amber-400'; // numbers
            if (/^"/.test(match)) {
                if (/:$/.test(match)) {
                    cls = 'text-sky-300 font-bold'; // keys
                } else {
                    cls = 'text-emerald-400'; // strings
                }
            } else if (/true|false/.test(match)) {
                cls = 'text-purple-400 font-bold'; // booleans
            } else if (/null/.test(match)) {
                cls = 'text-rose-400 font-bold'; // null
            }
            return `<span class="${cls}">${match}</span>`;
        }
    );
};

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
    const [distinctBasis, setDistinctBasis] = useState<string>('Encounter.id');
    const [sourceType, setSourceType] = useState<'FHIR' | 'Manual'>('FHIR'); // Default to FHIR
    const [steps, setSteps] = useState<CalculationStep[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [saveAttempted, setSaveAttempted] = useState(false);
    const [availableFactors, setAvailableFactors] = useState<Factor[]>([]);
    
    const [showJsonModal, setShowJsonModal] = useState(false);
    const [copied, setCopied] = useState(false);

    const currentFactorData: Factor = {
        id: initialData?.id || 'temp-factor-id',
        name,
        description,
        method,
        distinctBasis: method === 'distcount' ? distinctBasis : undefined,
        sourceType,
        steps
    };

    const handleCopyJson = () => {
        navigator.clipboard.writeText(JSON.stringify(currentFactorData, null, 2));
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    useEffect(() => {
        getFactors().then(setAvailableFactors).catch(console.error);
    }, []);


    const [isAiLoading, setIsAiLoading] = useState(false);

    useEffect(() => {
        if (initialData) {
            setName(initialData.name);
            setDescription(initialData.description);
            setMethod(initialData.method);
            setDistinctBasis(initialData.distinctBasis || 'Encounter.id');
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
                distinctBasis: method === 'distcount' ? distinctBasis : undefined,
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

    // AI Logic
    const handleSmartAnalyze = async () => {
        if (!description.trim()) return alert("請輸入描述文字以供分析。");
        setIsAiLoading(true);
        try {
            // Factor usually maps to Num or Den styled logic, passing 'numerator' as generic or we need to adjust API
            // Using 'numerator' as default since factors are criteria sets similar to numerator logic
            const res = await analyzeSectionDefinition(name, description, description, 'numerator');

            if (res?.steps) {
                const formatted = res.steps.map((s: any) => ({ ...s, id: Math.random().toString(36).substr(2, 9) }));
                setSteps([...steps, ...formatted]);
            }
        } catch (e: any) {
            console.error(e);
            alert("AI 分析失敗: " + (e.message || "未知錯誤"));
        } finally {
            setIsAiLoading(false);
        }
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

            {/* Distinct Basis (Conditional) */}
            {method === 'distcount' && (
                <div className="space-y-3 animate-in fade-in slide-in-from-top-2 mb-8">
                    <label className="text-sm font-black text-slate-500 uppercase tracking-widest ml-1">不重複依據 (Distinct By)</label>
                    <div className="relative">
                        <select
                            className="w-full bg-white border-2 rounded-xl px-4 py-4 font-bold text-lg text-indigo-700 outline-none border-indigo-200 focus:border-indigo-600 focus:ring-4 focus:ring-indigo-50 appearance-none cursor-pointer"
                            value={distinctBasis}
                            onChange={(e) => setDistinctBasis(e.target.value)}
                        >
                            <option value="Encounter.id">就醫號 (Encounter)</option>
                            <option value="Patient.id">病歷號 (Patient ID)</option>
                            <option value="Patient.identifier">身分證號 (ID No)</option>
                        </select>
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-indigo-400">
                            <ChevronDown size={20} />
                        </div>
                    </div>
                </div>
            )}

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
            <div className="mt-12 pt-8 border-t border-slate-100 flex justify-end gap-6 flex-wrap items-center">
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
                
                <button
                    type="button"
                    onClick={() => setShowJsonModal(true)}
                    className="flex items-center justify-center gap-2 px-8 py-4 text-emerald-600 font-black text-lg hover:bg-emerald-50 rounded-2xl transition-all border-2 border-emerald-200"
                    title="查看要素 API JSON 設定"
                >
                    <Code size={20} />
                    <span>查看 API JSON</span>
                </button>
                
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

            {/* API JSON Preview Modal */}
            {showJsonModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-6 animate-in fade-in duration-300">
                    {/* Backdrop */}
                    <div 
                        className="absolute inset-0 bg-slate-900/60 backdrop-blur-md cursor-pointer" 
                        onClick={() => setShowJsonModal(false)}
                    />
                    
                    {/* Modal Content */}
                    <div className="relative w-full max-w-4xl bg-white rounded-[2.5rem] border-2 border-slate-100 shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-300">
                        {/* Gradient header line */}
                        <div className="h-2 bg-gradient-to-r from-emerald-500 via-indigo-500 to-rose-500 w-full" />
                        
                        {/* Header */}
                        <div className="p-6 md:p-8 flex items-center justify-between border-b border-slate-100 bg-slate-50/50">
                            <div className="space-y-2">
                                <h3 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                                    <span className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center shadow-inner">
                                        <Code size={22} />
                                    </span>
                                    API JSON 設定確認 (要素)
                                </h3>
                                <p className="text-sm font-bold text-slate-400">
                                    此為該要素 (Factor) 同步至 API 與資料庫的完整定義結構，可用於確認 FHIR 欄位路徑與運算邏輯是否正確。
                                </p>
                            </div>
                            <button 
                                onClick={() => setShowJsonModal(false)} 
                                className="w-12 h-12 rounded-full border border-slate-200 bg-white flex items-center justify-center text-slate-400 hover:text-slate-800 hover:border-slate-300 shadow-sm transition-all hover:rotate-90 active:scale-95"
                            >
                                <X size={20} />
                            </button>
                        </div>
                        
                        {/* Body - Scrollable */}
                        <div className="p-6 md:p-8 overflow-y-auto bg-slate-50/20 flex-1 space-y-6">
                            <div className="relative rounded-3xl bg-slate-950 border-4 border-slate-900 p-6 shadow-inner group">
                                {/* Copy Button floating */}
                                <button
                                    onClick={handleCopyJson}
                                    className={`absolute top-4 right-4 flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all shadow-md active:scale-95 z-10 ${
                                        copied 
                                            ? 'bg-emerald-500 text-white shadow-emerald-200' 
                                            : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-700/50'
                                    }`}
                                >
                                    {copied ? (
                                        <>
                                            <Check size={14} className="animate-bounce" />
                                            <span>已複製 JSON！</span>
                                        </>
                                    ) : (
                                        <>
                                            <Copy size={14} />
                                            <span>複製設定 JSON</span>
                                        </>
                                    )}
                                </button>
                                
                                {/* JSON Display */}
                                <pre className="text-slate-300 font-mono text-[13px] leading-relaxed overflow-x-auto select-all custom-scrollbar pt-8">
                                    <code 
                                        className="block whitespace-pre select-all"
                                        dangerouslySetInnerHTML={{ __html: highlightJson(JSON.stringify(currentFactorData, null, 2)) }} 
                                    />
                                </pre>
                            </div>
                        </div>
                        
                        {/* Footer */}
                        <div className="p-6 md:p-8 border-t border-slate-100 flex justify-end gap-4 bg-slate-50/50">
                            <button 
                                onClick={() => setShowJsonModal(false)}
                                className="px-8 py-4 border border-slate-200 bg-white text-slate-500 hover:text-slate-800 hover:border-slate-300 rounded-2xl font-black transition-colors text-lg"
                            >
                                關閉視窗
                            </button>
                            <button 
                                onClick={handleCopyJson}
                                className="px-8 py-4 bg-slate-900 text-white hover:bg-indigo-600 rounded-2xl font-black transition-all flex items-center gap-2 active:scale-95 shadow-lg text-lg"
                            >
                                <Copy size={18} />
                                複製 JSON
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
