"use client";

import React, { useState, useEffect, useRef } from 'react';
import { QualityIndicator, CalculationStep, FhirResource, CalculationAction, ValueType, Factor } from '@/components/indicator/types';
import {
    Plus, Trash2, Database, Sparkles, Activity, MessageSquare, Zap,
    Loader2, Link2, Settings2, X, Info, Code, HelpCircle, Copy, Check,
    Layers, ChevronDown, Brain, Calculator, Hash, Tag, Replace, ArrowRight, Minus, Divide, Percent, Search,
    AlertTriangle, Wand2, Sparkle, Users, RefreshCw
} from 'lucide-react';
import { analyzeSectionDefinition, getAiFieldSuggestions, analyzeFullIndicator } from '@/app/actions/ai';
import { fetchFhirValues } from '@/services/fhir';
import { useSettings } from '@/contexts/SettingsContext';
import { saveIndicator } from '@/app/actions/save-indicator';
import { syncIndicatorToElements } from '@/app/actions/sync-indicator-to-elements';
import { getFactors } from '@/app/actions/kift';
import { startTransition } from 'react'; // Actually better to use useTransition hook
import { CriterionRow } from './CriterionRow';

interface Props {
    onSave: (indicator: QualityIndicator) => void;
    onCancel: () => void;
    initialData?: QualityIndicator | null;
    availableIndicators?: QualityIndicator[];
    focusSection?: 'num' | 'den' | null;
}

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

const Section: React.FC<{
    title: string;
    sectionKey: 'num' | 'den' | 'ex';
    steps: CalculationStep[];
    setSteps: (steps: CalculationStep[]) => void;
    draft: string;
    setDraft: (draft: string) => void;
    color: string;
    icon: any;
    placeholder: string;
    isLoading: 'num' | 'den' | 'ex' | 'full' | null;
    onSmartAnalyze: (section: 'num' | 'den' | 'ex') => void;
    onAddStep: (section: 'num' | 'den' | 'ex') => void;
    availableIndicators: QualityIndicator[];
    availableFactors: Factor[];
    indicatorName: string;
    indicatorDescription: string;
    sectionName?: string;
    setSectionName?: (name: string) => void;
    saveAttempted?: boolean;
    calculationMethod?: 'sum' | 'count' | 'distcount';
    setCalculationMethod?: (val: 'sum' | 'count' | 'distcount') => void;
    distinctBasis?: string;
    setDistinctBasis?: (val: string) => void;
}> = ({ title, steps, setSteps, draft, setDraft, sectionKey, color, icon: Icon, placeholder, isLoading, onSmartAnalyze, onAddStep, availableIndicators, availableFactors, indicatorName,
    indicatorDescription, sectionName, setSectionName, saveAttempted, calculationMethod, setCalculationMethod,
    distinctBasis, setDistinctBasis
}) => {
        const { enableAi } = useSettings();
        return (
            <div className={`p-6 md:p-8 rounded-3xl border shadow-sm space-y-6 ${color}`}>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-white shadow-lg ${color.replace('border-', 'bg-').replace('/20', '')}`}>
                            <Icon size={32} />
                        </div>
                        <h3 className="font-black text-2xl text-slate-900 tracking-tight">{title}</h3>
                    </div>
                </div>

                {/* Factor Name & Calculation Method Row */}
                {(sectionKey === 'num' || sectionKey === 'den') && setSectionName && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-white/50 p-4 rounded-2xl border border-slate-100">
                        <div className="space-y-2">
                            <label className="text-sm font-black text-slate-500 uppercase tracking-widest ml-1">名稱 (Name)</label>
                            <div className="relative">
                                <input
                                    type="text"
                                    className={`w-full bg-white border-2 rounded-xl px-4 py-3 font-bold text-slate-700 outline-none transition-all ${saveAttempted && !sectionName?.trim() ? 'border-rose-400 placeholder:text-rose-300' : 'border-slate-200 focus:border-indigo-600 focus:ring-4 focus:ring-indigo-50'}`}
                                    placeholder={sectionKey === 'num' ? "輸入分子定義名稱 (必填)..." : "輸入分母定義名稱 (必填)..."}
                                    value={sectionName || ''}
                                    onChange={(e) => setSectionName(e.target.value)}
                                />
                                {saveAttempted && !sectionName?.trim() && (
                                    <div className="absolute -bottom-6 left-2 text-rose-500 text-[10px] font-bold animate-in slide-in-from-top-1">
                                        此名稱為必填欄位
                                    </div>
                                )}
                            </div>
                        </div>
                        {setCalculationMethod && (
                            <div className="space-y-2">
                                <label className="text-sm font-black text-slate-500 uppercase tracking-widest ml-1">計算方式 (Method)</label>
                                <div className="flex gap-2">
                                    <div className="relative flex-1">
                                        <select
                                            className="w-full bg-white border-2 rounded-xl px-4 py-3 font-bold text-slate-700 outline-none border-slate-200 focus:border-indigo-600 focus:ring-4 focus:ring-indigo-50 appearance-none cursor-pointer"
                                            value={calculationMethod || 'sum'}
                                            onChange={(e) => setCalculationMethod(e.target.value as any)}
                                        >
                                            <option value="sum">加總 (Sum)</option>
                                            <option value="count">計數 (Count)</option>
                                            <option value="distcount">不重複計數 (Distinct Count)</option>
                                        </select>
                                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                            <ChevronDown size={20} />
                                        </div>
                                    </div>
                                    {calculationMethod === 'distcount' && setDistinctBasis && (
                                        <div className="relative w-48 animate-in slide-in-from-left-2 fade-in">
                                            <select
                                                className="w-full bg-white border-2 rounded-xl px-4 py-3 font-bold text-indigo-700 outline-none border-indigo-200 focus:border-indigo-600 focus:ring-4 focus:ring-indigo-50 appearance-none cursor-pointer"
                                                value={distinctBasis || 'Encounter.id'}
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
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                <div className="bg-white/60 p-4 rounded-2xl border-2 border-dashed border-slate-200 space-y-3">
                    <div className="flex justify-between items-center px-1">
                        <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest">描述邏輯說明</label>
                        {(sectionKey === 'num' || sectionKey === 'den') && enableAi && (
                            <div className="flex items-center gap-2 bg-indigo-50 px-3 py-1 rounded-lg border border-indigo-100">
                                <Wand2 size={12} className="text-indigo-600" />
                                <span className="text-[10px] font-black text-indigo-600 uppercase">AI 輔助</span>
                            </div>
                        )}
                    </div>
                    <div className="flex gap-4">
                        <textarea className="flex-1 bg-white rounded-xl p-4 text-[14px] font-bold border-2 border-slate-100 focus:border-indigo-500 outline-none h-24 shadow-inner resize-none transition-all placeholder:text-slate-300 custom-scrollbar" placeholder={placeholder} value={draft} onChange={(e) => setDraft(e.target.value)} />
                        {enableAi && (
                            <button type="button" onClick={() => onSmartAnalyze(sectionKey)} disabled={isLoading === sectionKey || !draft.trim()} className="px-6 bg-slate-900 text-white rounded-2xl font-black text-sm shadow-xl hover:bg-slate-800 transition disabled:opacity-50 flex flex-col items-center justify-center gap-2 group min-w-[140px]">
                                {isLoading === sectionKey ? <Loader2 className="animate-spin" /> : <Brain size={24} className="group-hover:scale-110 transition-transform" />}
                                智慧建議
                            </button>
                        )}
                    </div>
                </div>
                <div className="space-y-3">
                    {steps.map((s: any) => (
                        <CriterionRow key={s.id} step={s} availableIndicators={availableIndicators} availableFactors={availableFactors} sectionKey={sectionKey} onRemove={() => setSteps(steps.filter((x: any) => x.id !== s.id))} onUpdate={(u) => setSteps(steps.map((x: any) => x.id === s.id ? { ...x, ...u } : x))} indicatorContext={{ name: indicatorName, description: indicatorDescription }} />
                    ))}
                    <button type="button" onClick={() => onAddStep(sectionKey)} className="w-full py-6 border-2 border-dashed border-slate-200 rounded-2xl text-slate-400 font-black hover:bg-white hover:border-indigo-300 hover:text-indigo-500 flex items-center justify-center gap-3 transition-all group text-base shadow-inner">
                        <Plus size={20} className="group-hover:rotate-90 transition-transform" /> 手動新增運算步驟
                    </button>
                </div>
            </div>
        );
    };

import { useRouter } from 'next/navigation'; // Add import

export const IndicatorForm: React.FC<Props> = ({ onSave, onCancel, initialData, availableIndicators = [], focusSection = null }) => {
    const router = useRouter(); // Init router
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [numeratorName, setNumeratorName] = useState('');
    const [denominatorName, setDenominatorName] = useState('');
    const [numeratorSteps, setNumeratorSteps] = useState<CalculationStep[]>([]);
    const [denominatorSteps, setDenominatorSteps] = useState<CalculationStep[]>([]);
    const [exclusionSteps, setExclusionSteps] = useState<CalculationStep[]>([]);
    const [numeratorMethod, setNumeratorMethod] = useState<'sum' | 'count' | 'distcount'>('sum');
    const [denominatorMethod, setDenominatorMethod] = useState<'sum' | 'count' | 'distcount'>('sum');
    const [numeratorDistinctBasis, setNumeratorDistinctBasis] = useState<string>('Encounter.id');
    const [denominatorDistinctBasis, setDenominatorDistinctBasis] = useState<string>('Encounter.id');
    const [frequency, setFrequency] = useState<'每日' | '每週' | '每月' | '每季' | '每半年' | '每年'>('每月');
    const [targetValue, setTargetValue] = useState<string>('');
    const [targetOperator, setTargetOperator] = useState<'>=' | '<=' | '>' | '<' | '='>('>=');
    const [numDraft, setNumDraft] = useState('');
    const [denDraft, setDenDraft] = useState('');
    const [exDraft, setExDraft] = useState('');
    const [isLoading, setIsLoading] = useState<'num' | 'den' | 'ex' | 'full' | null>(null);
    const [saveAttempted, setSaveAttempted] = useState(false);
    const { enableAi } = useSettings();
    const [availableFactors, setAvailableFactors] = useState<Factor[]>([]);
    
    const [showJsonModal, setShowJsonModal] = useState(false);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        getFactors().then(setAvailableFactors).catch(console.error);
    }, []);

    const nameInputRef = useRef<HTMLInputElement>(null);

    const currentIndicatorData: QualityIndicator = {
        id: initialData?.id || 'temp-id-for-preview',
        name,
        description,
        numeratorName,
        denominatorName,
        numeratorSteps,
        denominatorSteps,
        exclusionSteps,
        numeratorCalculationMethod: numeratorMethod,
        denominatorCalculationMethod: denominatorMethod,
        numeratorDistinctBasis: numeratorMethod === 'distcount' ? numeratorDistinctBasis : undefined,
        denominatorDistinctBasis: denominatorMethod === 'distcount' ? denominatorDistinctBasis : undefined,
        frequency: frequency,
        targetValue: targetValue ? parseFloat(targetValue) : undefined,
        targetOperator: targetOperator
    };

    const handleCopyJson = () => {
        navigator.clipboard.writeText(JSON.stringify(currentIndicatorData, null, 2));
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    useEffect(() => {
        if (initialData) {
            setName(initialData.name);
            setDescription(initialData.description);
            setNumeratorName(initialData.numeratorName || '');
            setDenominatorName(initialData.denominatorName || '');
            setNumeratorSteps(initialData.numeratorSteps || []);
            setDenominatorSteps(initialData.denominatorSteps || []);
            setExclusionSteps(initialData.exclusionSteps || []);
            setNumeratorMethod(initialData.numeratorCalculationMethod || 'sum');
            setDenominatorMethod(initialData.denominatorCalculationMethod || 'sum');
            setNumeratorDistinctBasis(initialData.numeratorDistinctBasis || 'Encounter.id');
            setDenominatorDistinctBasis(initialData.denominatorDistinctBasis || 'Encounter.id');
            setFrequency(initialData.frequency || '每月');
            setTargetValue(initialData.targetValue?.toString() || '');
            setTargetOperator(initialData.targetOperator || '>=');
        }
    }, [initialData]);

    const handleAddStep = (section: 'num' | 'den' | 'ex') => {
        const steps = section === 'num' ? numeratorSteps : section === 'den' ? denominatorSteps : exclusionSteps;
        const setter = section === 'num' ? setNumeratorSteps : section === 'den' ? setDenominatorSteps : setExclusionSteps;
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
        setter([...steps, newStep]);
    };

    const handleFullIndicatorSuggest = async () => {
        if (!name.trim() || !description.trim()) {
            alert("請先填寫指標名稱與指標描述以供 AI 進行完整建議。");
            return;
        }
        setIsLoading('full');
        try {
            const res = await analyzeFullIndicator(name, description);
            if (res.exclusionSteps) setExclusionSteps(res.exclusionSteps.map((s: any) => ({ ...s, id: Math.random().toString(36).substr(2, 9) })));
            if (res.denominatorSteps) setDenominatorSteps(res.denominatorSteps.map((s: any) => ({ ...s, id: Math.random().toString(36).substr(2, 9) })));
            if (res.numeratorSteps) setNumeratorSteps(res.numeratorSteps.map((s: any) => ({ ...s, id: Math.random().toString(36).substr(2, 9) })));
        } catch (e: any) {
            const message = e?.message || '';
            const isRateLimit = e?.status === 429 || message.includes('429') || message.includes('quota') || message.includes('Too Many Requests');

            if (isRateLimit) {
                alert("免費資源已用完，請等待資源提供完成時間。");
            } else {
                alert(`智慧建議生成失敗: ${message}`);
            }
        } finally {
            setIsLoading('full');
            setTimeout(() => setIsLoading(null), 500);
        }
    };

    const handleSmartAnalyze = async (section: 'num' | 'den' | 'ex') => {
        const draft = section === 'num' ? numDraft : section === 'den' ? denDraft : exDraft;
        if (!draft.trim()) return alert("請輸入描述文字以供分析。");
        setIsLoading(section);
        try {
            const res = await analyzeSectionDefinition(name, description, draft, section === 'num' ? 'numerator' : section === 'den' ? 'denominator' : 'exclusion');
            if (res?.steps) {
                const formatted = res.steps.map((s: any) => ({ ...s, id: Math.random().toString(36).substr(2, 9) }));
                if (section === 'num') setNumeratorSteps([...numeratorSteps, ...formatted]);
                else if (section === 'den') setDenominatorSteps([...denominatorSteps, ...formatted]);
                else setExclusionSteps([...exclusionSteps, ...formatted]);
            }
        } catch (e: any) {
            const message = e?.message || '';
            const isRateLimit = e?.status === 429 || message.includes('429') || message.includes('quota') || message.includes('Too Many Requests');
            if (isRateLimit) {
                alert("免費資源已用完，請等待資源提供完成時間。");
            } else {
                alert(`分析失敗: ${message}`);
            }
        }
        finally { setIsLoading(null); }
    };

    const handleSave = () => {
        setSaveAttempted(true);
        if (!name.trim() || !numeratorName.trim() || !denominatorName.trim()) {
            window.scrollTo({ top: 0, behavior: 'smooth' });
            setTimeout(() => nameInputRef.current?.focus(), 500); // Focus on main name, but validation will show for all
            return;
        }

        const indicatorData: QualityIndicator = {
            id: initialData?.id || Math.random().toString(36).substr(2, 9),
            name, description,
            numeratorName, denominatorName,
            numeratorSteps, denominatorSteps, exclusionSteps,
            numeratorCalculationMethod: numeratorMethod,
            denominatorCalculationMethod: denominatorMethod,
            numeratorDistinctBasis: numeratorMethod === 'distcount' ? numeratorDistinctBasis : undefined,
            denominatorDistinctBasis: denominatorMethod === 'distcount' ? denominatorDistinctBasis : undefined,
            frequency: frequency,
            targetValue: targetValue ? parseFloat(targetValue) : undefined,
            targetOperator: targetOperator
        };

        // Call server action to save to DB
        // Note: IndicatorForm is client component, we can call server action directly.
        // Ideally we should await this. But onSave prop might expect sync or we just fire and forget or let parent handle.
        // The prompt implies we should implement saving. Let's try to call it here or inside onSave if onSave was mapped to it?
        // Actually, the page passes `handleSave` which probably just updates state in page.
        // We probably should call the server action HERE, then call onSave to update parent UI state.

        startTransition(async () => {
            try {
                const result = await saveIndicator(indicatorData);
                if (!result.success) {
                    alert("儲存失敗: " + result.message);
                    return;
                }
                // Update ID if it was a new insert and we got a real ID back?
                // For now just proceed.
                onSave({ ...indicatorData, id: result.kpiid || indicatorData.id });
            } catch (e) {
                alert("儲存發生錯誤");
                console.error(e);
            }
        });
    };




    const handleSync = async () => {
        if (!initialData?.id) {
            alert("請先儲存指標後再執行同步。");
            return;
        }

        const ok = confirm(`確定要將「${name}」的邏輯同步至要素庫嗎？\n這將建立或更新關聯的要素，並轉換為要素管理模式。`);
        if (!ok) return;

        try {
            alert("同步中，請稍候...");
            const res = await syncIndicatorToElements(initialData.id);

            if (res.success) {
                alert(`同步完成！\n${res.message}`);

                // Refresh Factors List to ensure the new factor is recognized
                getFactors().then(setAvailableFactors).catch(console.error);

                // Update local state with the returned new steps (Factor References)
                if (res.data) {
                    // Force update steps to show the new Factor Reference
                    if (res.data.numeratorSteps && res.data.numeratorSteps.length > 0) {
                        setNumeratorSteps(res.data.numeratorSteps as any);
                    }
                    if (res.data.denominatorSteps && res.data.denominatorSteps.length > 0) {
                        setDenominatorSteps(res.data.denominatorSteps as any);
                    }

                    // Update names if they were normalized
                    if (res.data.numeratorName) setNumeratorName(res.data.numeratorName);
                    if (res.data.denominatorName) setDenominatorName(res.data.denominatorName);
                }

                // Do NOT call onSave immediately here, as it might save the old state if state updates haven't flushed?
                // Actually, since we just updated state setters, next render will have new values.
                // But onSave usually takes the *current* state variables which are closures?
                // Wait, handleSave constructs object from state variables. 
                // State updates are async. calling onSave() right here will use OLD state.
                // WE SHOULD NOT CALL onSave(). The DB is already updated by the server action!
                // We just need to update the UI to reflect DB.

                // Update the initialData ref so if user cancels/reverts, it knows about the new ID?
                if (onSave) {
                    // We construct the new object manually to pass to parent, avoiding async state issues
                    const updatedIndicator = {
                        ...initialData,
                        numeratorSteps: (res.data?.numeratorSteps || []) as any,
                        denominatorSteps: (res.data?.denominatorSteps || []) as any,
                        numeratorName: res.data?.numeratorName || numeratorName,
                        denominatorName: res.data?.denominatorName || denominatorName,
                        numeratorDistinctBasis: numeratorDistinctBasis,
                        denominatorDistinctBasis: denominatorDistinctBasis
                    };
                    onSave(updatedIndicator);
                }

            } else {
                alert(`同步失敗: ${res.message}`);
            }
        } catch (err: any) {
            alert("執行錯誤: " + err.message);
        }
    };

    return (
        <div className="bg-white p-4 md:p-6 rounded-[2.5rem] border-2 border-slate-100 shadow-2xl relative pb-32 mx-[2px] max-w-[calc(100%-4px)] overflow-hidden animate-in fade-in slide-in-from-bottom-8 duration-700">
            <div className="absolute top-0 left-0 w-full h-4 bg-indigo-600"></div>

            {!focusSection ? (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-12 pt-8 px-4 items-end">
                    {/* 指標名稱：加寬至 5 欄位 */}
                    <div className="lg:col-span-5 space-y-4">
                        <label className="flex items-center gap-2 text-2xl font-black text-slate-900 tracking-tight ml-2">
                            指標名稱 <span className="text-rose-500 text-lg font-black">*</span>
                        </label>
                        <div className="relative">
                            <input
                                ref={nameInputRef}
                                type="text"
                                className={`w-full border-2 rounded-2xl px-6 h-[72px] focus:ring-[8px] outline-none font-black text-xl transition-all ${saveAttempted && !name.trim() ? 'border-rose-300 bg-rose-50 ring-rose-100 focus:ring-rose-200' : 'border-slate-100 bg-slate-50 ring-indigo-50 focus:bg-white focus:ring-indigo-100'}`}
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="名稱..."
                            />
                            {saveAttempted && !name.trim() && (
                                <div className="absolute -bottom-8 left-6 flex items-center gap-2 text-rose-500 text-[10px] font-bold animate-in slide-in-from-top-2">
                                    <AlertTriangle size={12} /> 名稱必填
                                </div>
                            )}
                        </div>
                    </div>
                    {/* 指標描述：相對縮減至 7 欄位 */}
                    <div className="lg:col-span-7 space-y-4">
                        <label className="block text-2xl font-black text-slate-900 tracking-tight ml-2">指標功能描述</label>
                        <div className="flex gap-4 h-[72px]">
                            <input
                                type="text"
                                className="flex-1 border-2 rounded-2xl px-6 focus:ring-[8px] focus:ring-indigo-50 outline-none border-slate-100 bg-slate-50 font-black text-xl transition-all focus:bg-white"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="描述臨床監測目標與核心運算邏輯..."
                            />
                            {enableAi && (
                                <button
                                    type="button"
                                    onClick={handleFullIndicatorSuggest}
                                    disabled={isLoading === 'full'}
                                    className="px-8 bg-indigo-600 text-white rounded-2xl font-black text-sm shadow-xl hover:bg-indigo-700 transition flex items-center gap-3 disabled:opacity-50 shrink-0 group h-full"
                                >
                                    {isLoading === 'full' ? <Loader2 className="animate-spin" size={20} /> : <Sparkle size={20} className="group-hover:rotate-12 transition-transform" />}
                                    智慧建議
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            ) : (
                <div className="mb-8 pt-8 px-4 flex items-center justify-between">
                    <div>
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-1">正在編輯要素 (Editing Factor)</span>
                        <h2 className="text-2xl font-black text-slate-800 flex items-center gap-2">
                            {focusSection === 'num' ? <span className="text-emerald-600">分子定義 (Numerator)</span> : <span className="text-blue-600">分母定義 (Denominator)</span>}
                            <span className="text-slate-300 text-lg mx-2">/</span>
                            <span className="text-slate-500 text-base font-bold">{name || '(未命名指標)'}</span>
                        </h2>
                    </div>
                </div>
            )}

            {!focusSection && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 px-4 mb-12">
                    {/* 基本設定: 頻率 */}
                    <div className="lg:col-span-5">
                        <label className="block text-2xl font-black text-slate-900 tracking-tight ml-2 mb-4">監控週期</label>
                        <div className="relative w-fit">
                            <select
                                className="w-auto min-w-[180px] bg-slate-50 border-2 border-slate-100 rounded-2xl pl-6 pr-12 py-4 font-black text-lg text-slate-700 outline-none focus:border-indigo-500 focus:bg-white transition-all appearance-none cursor-pointer hover:border-indigo-200"
                                value={frequency}
                                onChange={(e) => setFrequency(e.target.value as any)}
                            >
                                <option value="每日">每日 (Daily)</option>
                                <option value="每週">每週 (Weekly)</option>
                                <option value="每月">每月 (Monthly)</option>
                                <option value="每季">每季 (Quarterly)</option>
                                <option value="每半年">每半年 (Half Year)</option>
                                <option value="每年">每年 (Yearly)</option>
                            </select>
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                <ChevronDown size={24} />
                            </div>
                        </div>
                    </div>

                    {/* 目標值設定 */}
                    <div className="lg:col-span-7">
                        <label className="block text-2xl font-black text-slate-900 tracking-tight ml-2 mb-4">目標值設定 (Target)</label>
                        <div className="flex items-center gap-4">
                            <div className="relative w-32 md:w-40 shrink-0">
                                <select
                                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-4 py-4 font-black text-lg text-slate-700 outline-none focus:border-indigo-500 focus:bg-white transition-all appearance-none cursor-pointer hover:border-indigo-200 text-center"
                                    value={targetOperator}
                                    onChange={(e) => setTargetOperator(e.target.value as any)}
                                >
                                    <option value=">=">&ge; (大於等於)</option>
                                    <option value="<=">&le; (小於等於)</option>
                                    <option value=">">&gt; (大於)</option>
                                    <option value="<">&lt; (小於)</option>
                                    <option value="=">= (等於)</option>
                                </select>
                                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                    <ChevronDown size={20} />
                                </div>
                            </div>
                            <div className="relative flex-1">
                                <input
                                    type="number"
                                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-4 font-black text-lg text-slate-700 outline-none focus:border-indigo-500 focus:bg-white transition-all hover:border-indigo-200"
                                    placeholder="目標 (e.g. 80)"
                                    value={targetValue}
                                    onChange={(e) => setTargetValue(e.target.value)}
                                />
                                <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 font-black text-sm">
                                    %
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className="space-y-12">
                {!focusSection && (
                    <Section title="排除個案 (Exclusions)" sectionKey="ex" steps={exclusionSteps} setSteps={setExclusionSteps} draft={exDraft} setDraft={setExDraft} color="border-rose-100 bg-rose-50/20" icon={X} placeholder="輸入排除條件..." onSmartAnalyze={handleSmartAnalyze} onAddStep={handleAddStep} isLoading={isLoading} availableIndicators={availableIndicators} availableFactors={availableFactors} indicatorName={name} indicatorDescription={description} />
                )}
                {(!focusSection || focusSection === 'den') && (
                    <Section title="分母 (Denominator)" sectionKey="den" steps={denominatorSteps} setSteps={setDenominatorSteps} draft={denDraft} setDraft={setDenDraft} color="border-slate-100 bg-slate-50/30" icon={Users} placeholder="輸入分母條件，AI 將協助自動填寫運算邏輯..." onSmartAnalyze={handleSmartAnalyze} onAddStep={handleAddStep} isLoading={isLoading} availableIndicators={availableIndicators} availableFactors={availableFactors} indicatorName={name} indicatorDescription={description}
                        sectionName={denominatorName} setSectionName={setDenominatorName} saveAttempted={saveAttempted} calculationMethod={denominatorMethod} setCalculationMethod={setDenominatorMethod}
                        distinctBasis={denominatorDistinctBasis} setDistinctBasis={setDenominatorDistinctBasis}
                    />
                )}
                {(!focusSection || focusSection === 'num') && (
                    <Section title="分子 (Numerator)" sectionKey="num" steps={numeratorSteps} setSteps={setNumeratorSteps} draft={numDraft} setDraft={setNumDraft} color="border-indigo-100 bg-indigo-50/20" icon={Calculator} placeholder="輸入合格條件，AI 將協助自動填寫運算邏輯..." onSmartAnalyze={handleSmartAnalyze} onAddStep={handleAddStep} isLoading={isLoading} availableIndicators={availableIndicators} availableFactors={availableFactors} indicatorName={name} indicatorDescription={description}
                        sectionName={numeratorName} setSectionName={setNumeratorName} saveAttempted={saveAttempted} calculationMethod={numeratorMethod} setCalculationMethod={setNumeratorMethod}
                        distinctBasis={numeratorDistinctBasis} setDistinctBasis={setNumeratorDistinctBasis}
                    />
                )}
            </div>

            <div className="mt-20 flex flex-col md:flex-row justify-end items-center md:items-start gap-10 border-t pt-12">
                {!focusSection && (
                    <div className="flex items-center gap-5 text-slate-400 text-sm font-bold bg-slate-50 px-8 py-5 rounded-2xl border border-slate-100 shadow-sm mr-auto">
                        <Percent size={28} className="text-indigo-600" />
                        <div className="flex flex-col">
                            <span className="text-slate-400 text-[9px] uppercase font-black tracking-widest mb-0.5">達成率公式</span>
                            <span className="text-slate-900 font-black text-lg tracking-tighter">( 分子 / 分母 ) × 100%</span>
                        </div>
                    </div>
                )}
                <div className="flex gap-4 w-full md:w-auto items-center flex-wrap justify-end">
                    {/* Feature Definition Button - Only for existing indicators */}
                    {!focusSection && initialData?.id && (
                        <button
                            type="button"
                            onClick={() => {
                                if (!initialData.id || initialData.id === 'undefined' || initialData.id.startsWith('new') || initialData.id.startsWith('ind-')) {
                                    alert("請先儲存指標以產生有效 ID，再進行明細欄位定義。");
                                    return;
                                }
                                // Use window.location as fallback or router
                                router.push(`/indicators/${initialData.id}/features`);
                            }}
                            className="flex items-center gap-2 px-6 py-4 text-slate-600 font-bold hover:bg-slate-50 rounded-2xl transition-all border border-slate-200"
                            title="設定明細表欄位"
                        >
                            <Settings2 size={20} />
                            {/* <Table size={20} /> */}
                            <span className="hidden md:inline">明細欄位定義</span>
                        </button>
                    )}

                    {/* Sync Button */}
                    {!focusSection && initialData?.id &&
                        !numeratorSteps.some(s => s.valueType === 'factor') &&
                        !denominatorSteps.some(s => s.valueType === 'factor') && (
                            <button
                                type="button"
                                onClick={handleSync}
                                className="flex items-center gap-2 px-6 py-4 text-indigo-600 font-bold hover:bg-indigo-50 rounded-2xl transition-all"
                                title="同步至要素庫"
                            >
                                <RefreshCw size={20} />
                                <span className="hidden md:inline">同步至要素</span>
                            </button>
                        )}

                    <button
                        type="button"
                        onClick={() => setShowJsonModal(true)}
                        className="flex-1 md:flex-none flex items-center justify-center gap-2 px-8 py-6 text-emerald-600 font-black text-xl hover:bg-emerald-50 rounded-[2rem] transition-all border-2 border-emerald-200"
                        title="查看設定的 API JSON"
                    >
                        <Code size={20} />
                        <span>查看 API JSON</span>
                    </button>
                    <button type="button" onClick={onCancel} className="flex-1 md:flex-none px-10 py-6 text-slate-400 hover:text-slate-800 font-black text-xl transition-colors">取消</button>
                    <button type="button" onClick={handleSave} className="flex-1 md:flex-none px-12 md:px-20 py-8 bg-slate-900 text-white rounded-[2rem] font-black hover:bg-indigo-600 shadow-2xl transition-all text-xl md:text-2xl active:scale-95">
                        {focusSection ? '儲存要素設定' : '儲存指標設定'}
                    </button>
                </div>
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
                                    API JSON 設定確認
                                </h3>
                                <p className="text-sm font-bold text-slate-400">
                                    此為同步至 API 與資料庫的完整指標定義結構，可用於確認 FHIR 欄位路徑與運算邏輯是否正確。
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
                                        dangerouslySetInnerHTML={{ __html: highlightJson(JSON.stringify(currentIndicatorData, null, 2)) }} 
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
};
