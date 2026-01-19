"use client";

import React, { useState, useEffect, useRef } from 'react';
import { QualityIndicator, CalculationStep, FhirResource, CalculationAction, ValueType } from '@/components/indicator/types';
import {
    Plus, Trash2, Database, Sparkles, Activity, MessageSquare, Zap,
    Loader2, Link2, Settings2, X, Info, Code, HelpCircle,
    Layers, ChevronDown, Brain, Calculator, Hash, Tag, Replace, ArrowRight, Minus, Divide, Percent, Search,
    AlertTriangle, Wand2, Sparkle, Users, Timer
} from 'lucide-react';
import { getAiFieldSuggestions } from '@/app/actions/ai';
import { fetchFhirValues } from '@/services/fhir';
import { useSettings } from '@/contexts/SettingsContext';
import { RESOURCE_CONFIG, PREDEFINED_VALUES } from '@/components/indicator/resource-config';


export const ACTION_GROUPS: Record<string, { label: string; actions: CalculationAction[] }> = {
    logical: {
        label: '集合運算',
        actions: ['AND', 'OR', 'NOT']
    },
    arithmetic: {
        label: '數值運算',
        actions: ['ADD', 'SUBTRACT', 'MULTIPLY', 'DIVIDE']
    }
};

export const ACTION_MAP: Record<CalculationAction, { label: string; icon: any; color: string; type: 'logical' | 'arithmetic' | 'base' }> = {
    BASE: { label: '起始數據', icon: Database, color: 'bg-slate-900', type: 'base' },
    AND: { label: '且', icon: Layers, color: 'bg-indigo-600', type: 'logical' },
    OR: { label: '或', icon: Layers, color: 'bg-indigo-400', type: 'logical' },
    NOT: { label: '排除', icon: X, color: 'bg-rose-500', type: 'logical' },
    ADD: { label: '加', icon: Plus, color: 'bg-emerald-600', type: 'arithmetic' },
    SUBTRACT: { label: '減', icon: Minus, color: 'bg-orange-600', type: 'arithmetic' },
    MULTIPLY: { label: '乘', icon: X, color: 'bg-amber-600', type: 'arithmetic' },
    DIVIDE: { label: '除', icon: Divide, color: 'bg-cyan-600', type: 'arithmetic' },
};

const ValuePopover: React.FC<{ value: string; }> = ({ value }) => {
    const [isOpen, setIsOpen] = useState(false);
    return (
        <>
            {isOpen && (
                <>
                    <div className="fixed inset-0 z-[150]" onClick={() => setIsOpen(false)}></div>
                    <div className="fixed z-[200] bg-white p-6 rounded-2xl shadow-2xl border-2 border-slate-100 max-w-lg w-full animate-in zoom-in-95" style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}>
                        <div className="flex justify-between items-center mb-4">
                            <h4 className="font-black text-slate-800 text-lg">完整內容</h4>
                            <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-slate-100 rounded-full text-slate-400"><X size={20} /></button>
                        </div>
                        <div className="bg-slate-50 p-4 rounded-xl text-slate-700 font-bold break-all max-h-[60vh] overflow-y-auto">
                            {value}
                        </div>
                    </div>
                </>
            )}
            <button
                type="button"
                onClick={() => setIsOpen(true)}
                className="text-[10px] font-black text-indigo-500 hover:text-indigo-700 underline decoration-dashed underline-offset-4 shrink-0"
            >
                顯示更多
            </button>
        </>
    );
};

import { SearchableDropdown } from '@/components/indicator/SearchableDropdown';






const OPERATOR_OPTIONS = [
    { value: 'equals', label: '等於', detail: '等於 (=)' },
    { value: 'matchesCode', label: '代碼比對', detail: '代碼比對 (In ValueSet)' },
    { value: 'contains', label: '包含', detail: '包含 (Contains)' },
    { value: 'greaterThan', label: '大於', detail: '大於 (>)' },
    { value: 'lessThan', label: '小於', detail: '小於 (<)' },
    { value: 'exists', label: '存在', detail: '存在 (Exists)' },
    { value: 'timing-window', label: '時效判定', detail: '時效判定 (Time Window)' },
];

export const CriterionRow: React.FC<{
    step: CalculationStep;
    onUpdate: (updates: Partial<CalculationStep>) => void;
    onRemove: () => void;
    availableIndicators: QualityIndicator[];
    availableFactors?: any[]; // Allow generic or specific type if imported
    indicatorContext: { name: string; description: string };
    sectionKey?: string;
}> = ({ step, onUpdate, onRemove, availableIndicators, availableFactors = [], indicatorContext, sectionKey }) => {
    const isBase = step.action === 'BASE';
    const actionInfo = ACTION_MAP[step.action] || { label: step.action, icon: AlertTriangle, color: 'bg-slate-400', type: 'logical' };
    const [isAiLoading, setIsAiLoading] = useState<'path' | 'value' | null>(null);
    const [aiSuggestions, setAiSuggestions] = useState<{ path: any[]; value: any[] }>({ path: [], value: [] });
    const [isResourceOpen, setIsResourceOpen] = useState(false);
    const [isOperatorOpen, setIsOperatorOpen] = useState(false);
    const [isTimingModalOpen, setIsTimingModalOpen] = useState(false);

    const [isFetchingValues, setIsFetchingValues] = useState(false);
    const [fetchedValues, setFetchedValues] = useState<string[]>([]);
    const { enableAi } = useSettings();

    const handleAiSuggest = async (type: 'path' | 'value') => {
        if (type === 'value' && !step.path) return alert("請先選擇欄位路徑。");
        setIsAiLoading(type);
        try {
            const res = await getAiFieldSuggestions(type, { indicatorName: indicatorContext.name, indicatorDesc: indicatorContext.description, resourceType: step.resourceType || 'Observation', path: step.path });
            setAiSuggestions(prev => ({ ...prev, [type]: res }));
        } catch (e: any) {
            const message = e?.message || '';
            const isRateLimit = e?.status === 429 || message.includes('429') || message.includes('quota') || message.includes('Too Many Requests');
            if (isRateLimit) {
                alert("免費資源已用完，請等待資源提供完成時間。");
            } else {
                alert("智慧建議獲取失敗。");
            }
        }
        finally { setIsAiLoading(null); }
    };

    const handleFetchValues = async (searchTerm?: string) => {
        if (!step.path) return alert("請先選擇欄位路徑。");
        setIsFetchingValues(true);
        try {
            const values = await fetchFhirValues(step.resourceType || 'Observation', step.path, searchTerm);
            setFetchedValues(values);
        } catch (e) {
            alert("獲取值失敗");
        } finally {
            setIsFetchingValues(false);
        }
    };

    const [dbValueSets, setDbValueSets] = useState<any[]>([]);

    useEffect(() => {
        // Load dynamic value sets on mount
        import('@/app/actions/valuesets').then(mod => {
            mod.getValueSets().then(sets => setDbValueSets(sets));
        });
    }, []);

    const getCombinedOptions = (type: 'path' | 'value') => {
        if (type === 'path') {
            const config = step.resourceType ? RESOURCE_CONFIG[step.resourceType] : null;
            const basePaths = config ? config.paths : [];
            const aiPaths = aiSuggestions.path.map((p: any) => ({ value: p.fhir_path || p.path, label: `${p.name} (${p.description})` }));
            // Deduplicate
            return [...basePaths, ...aiPaths].filter((v, i, a) => a.findIndex(t => t.value === v.value) === i);
        } else {
            // Values (AI + Fetched + Predefined + DB Dynamic)
            const aiValues = aiSuggestions.value.map((v: any) => ({ value: v.value_code || v.value, label: `${v.display_name || v.value} (${v.description})` }));
            const serverValues = fetchedValues.map(v => ({ value: v, label: v }));

            // 1. Static Predefined
            let predefined: { value: string; label: string }[] = [];
            if (step.resourceType && step.path) {
                const key = `${step.resourceType}.${step.path}`;
                const config = PREDEFINED_VALUES[key];
                if (config) {
                    predefined = config.map(c => ({
                        value: c.value,
                        label: c.description ? `🔖 ${c.value} (${c.description})` : `🔖 ${c.label}`
                    }));
                }
            }

            // 2. DB Dynamic ValueSets
            const dynamicSets = dbValueSets.map(ds => ({
                value: ds.set_id,
                label: ds.set_name ? `📦 [值集] ${ds.set_name} (${ds.set_id})` : `📦 [值集] ${ds.set_id}`
            }));

            // 3. AI & Server Values (Standard)
            const standardValues = [...aiValues, ...serverValues].map(v => ({
                ...v,
                label: v.label.startsWith('📦') || v.label.startsWith('🔖') ? v.label : `🔹 ${v.label}`
            }));

            return [...predefined, ...dynamicSets, ...standardValues].filter((v, i, a) => a.findIndex(t => t.value === v.value) === i);
        }
    };

    return (
        <div className="bg-slate-50/50 p-4 rounded-2xl border border-slate-200 hover:border-indigo-300 transition-colors group relative animate-in fade-in slide-in-from-left-4">
            <div className="flex flex-col xl:flex-row gap-4 items-start">
                {/* 1. 操作運算符 (Operator) - First Column (Hidden if BASE) */}
                {!isBase && (
                    <div className="w-[120px] shrink-0">
                        <div className="flex flex-col gap-1.5">
                            <div className="flex items-center px-1 h-5 overflow-hidden"><label className="text-[12px] font-black text-slate-400 uppercase tracking-widest leading-none truncate">運算邏輯</label></div>

                            {/* Dropdown for Action Selection */}
                            <div className="relative">
                                <select
                                    className={`w-full appearance-none text-white pl-10 pr-4 py-2 rounded-xl text-[14px] font-black outline-none focus:ring-4 focus:ring-indigo-100 transition-all shadow-md h-[64px] ${actionInfo.color}`}
                                    value={step.action}
                                    disabled={isBase}
                                    onChange={(e) => onUpdate({ action: e.target.value as CalculationAction })}
                                >
                                    {isBase ? (
                                        <option value="BASE">起始數據 (Base)</option>
                                    ) : (
                                        <>
                                            <optgroup label="集合運算">
                                                <option value="AND">且 (AND)</option>
                                                <option value="OR">或 (OR)</option>
                                                <option value="NOT">排除 (NOT)</option>
                                            </optgroup>
                                            <optgroup label="數值運算">
                                                <option value="ADD">加 (+)</option>
                                                <option value="SUBTRACT">減 (-)</option>
                                                <option value="MULTIPLY">乘 (*)</option>
                                                <option value="DIVIDE">除 (/)</option>
                                            </optgroup>
                                        </>
                                    )}
                                </select>
                                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-white/90 pointer-events-none">
                                    {React.createElement(actionInfo.icon, { size: 18 })}
                                </div>
                                {!isBase && (
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-white/70 pointer-events-none">
                                        <ChevronDown size={14} />
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* 2. 資料來源 & 3. 備註 - Main Grid */}
                <div className="flex-1 w-full grid grid-cols-1 lg:grid-cols-12 gap-3">
                    <div className="col-span-1 lg:col-span-2">
                        <div className="flex flex-col gap-1.5">
                            <div className="flex items-center px-1 h-5 overflow-hidden">
                                <label className="text-[12px] font-black text-slate-400 uppercase tracking-widest leading-none truncate">資料來源</label>
                            </div>
                            <div className="relative">
                                <select
                                    className="w-full bg-slate-50 border-2 border-transparent rounded-xl px-3 py-2 text-[14px] font-black text-slate-700 outline-none focus:border-indigo-500 focus:bg-white transition-all h-[64px]"
                                    value={step.valueType}
                                    onChange={(e) => onUpdate({ valueType: e.target.value as ValueType })}
                                >
                                    <option value="fhir_filter">FHIR 條件</option>
                                    <option value="indicator_result">引用指標</option>
                                    <option value="factor">要素</option>
                                    <option value="constant">自訂常數</option>
                                    <option value="calculated_field">公式/時間 (Formula)</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    <div className="col-span-1 lg:col-span-8">
                        {/* Special Case: Handle Corrupted 'Factor' Resource Type (from Sync) */}
                        {(step.resourceType as any) === 'Factor' ? (
                            <div className="flex gap-2 h-full items-center">
                                <div className="flex-1 flex flex-col gap-1.5">
                                    <div className="flex items-center px-1 h-5 overflow-hidden"><label className="text-[12px] font-black text-slate-400 uppercase tracking-widest leading-none">引用要素 (Factor)</label></div>
                                    <div className="relative group">
                                        {/* Auto-correction note */}
                                        <div className="absolute right-0 -top-6 text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-bold">
                                            Auto-Linked (Please Re-select)
                                        </div>
                                        <SearchableDropdown
                                            label="要素 (Factor)"
                                            value={step.value || ''}
                                            placeholder="請重新選擇要素..."
                                            options={availableFactors.map(f => ({ value: f.name, label: f.name }))} // Use name as value to match existing logic
                                            onChange={(v) => {
                                                // Migration: Fix the type and value simultaneously
                                                onUpdate({ valueType: 'factor', resourceType: undefined as any, value: v });
                                            }}
                                        />
                                    </div>
                                </div>
                            </div>
                        ) : step.valueType === 'fhir_filter' ? (
                            <div className="grid grid-cols-12 gap-3">
                                {/* 資源類型 col-2 */}
                                <div className="col-span-2">
                                    <div className="flex flex-col gap-1.5 relative">
                                        <div className="flex items-center px-1 h-5 overflow-hidden">
                                            <label className="text-[12px] font-black text-slate-400 uppercase tracking-widest leading-none">資源類型</label>
                                        </div>
                                        <button
                                            type="button"
                                            className={`w-full text-left bg-indigo-50 border-2 border-indigo-100 rounded-xl px-3 py-2 text-[14px] font-black transition-all flex items-center justify-between h-[64px] hover:border-indigo-300 ${!step.resourceType ? 'text-slate-400' : 'text-indigo-900'}`}
                                            onClick={() => setIsResourceOpen(!isResourceOpen)}
                                        >
                                            {step.resourceType ? (
                                                <span className="truncate">{RESOURCE_CONFIG[step.resourceType]?.label?.split(' (')[0] || step.resourceType}</span>
                                            ) : (
                                                <span>選擇資源...</span>
                                            )}
                                            <ChevronDown size={14} className="opacity-50" />
                                        </button>

                                        {isResourceOpen && (
                                            <>
                                                <div className="fixed inset-0 z-[50]" onClick={() => setIsResourceOpen(false)}></div>
                                                <div className="absolute top-full left-0 min-w-full w-max mt-2 bg-white border border-slate-100 rounded-2xl shadow-2xl z-[100] max-h-60 overflow-y-auto p-2 space-y-1 animate-in fade-in slide-in-from-top-2 custom-scrollbar">
                                                    {Object.entries(RESOURCE_CONFIG).map(([k, v]) => (
                                                        <button
                                                            key={k}
                                                            type="button"
                                                            className={`w-full text-left px-4 py-3 hover:bg-indigo-50 rounded-xl transition-colors flex flex-col group ${step.resourceType === k ? 'bg-indigo-50' : ''}`}
                                                            onClick={() => {
                                                                onUpdate({ resourceType: k as FhirResource, path: '' });
                                                                setIsResourceOpen(false);
                                                            }}
                                                        >
                                                            <span className={`text-sm font-bold group-hover:text-indigo-700 ${step.resourceType === k ? 'text-indigo-700' : 'text-slate-700'}`}>
                                                                {v.label}
                                                            </span>
                                                        </button>
                                                    ))}
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>

                                {/* 欄位路徑 col-3 */}
                                <div className="col-span-3">
                                    <SearchableDropdown
                                        label="欄位路徑"
                                        value={step.path || ''}
                                        placeholder="路徑..."
                                        options={getCombinedOptions('path')}
                                        onChange={(v) => onUpdate({ path: v })}
                                        onAiSuggest={() => handleAiSuggest('path')}
                                        isLoadingAi={isAiLoading === 'path'}
                                        renderSelected={(opt) => opt.label.split('(')[0].trim()}
                                    />
                                </div>

                                {/* 運算符 col-2 */}
                                <div className="col-span-2">
                                    <div className="flex flex-col gap-1.5">
                                        <div className="flex items-center px-1 h-5 overflow-hidden">
                                            <label className="text-[12px] font-black text-slate-400 uppercase tracking-widest leading-none">比對方式</label>
                                        </div>
                                        <div className="relative">
                                            <button
                                                type="button"
                                                className="w-full bg-slate-50 border-2 border-transparent rounded-xl px-3 py-2 text-[14px] font-black text-slate-700 outline-none hover:border-indigo-300 focus:border-indigo-500 transition-all h-[64px] flex items-center justify-between"
                                                onClick={() => setIsOperatorOpen(!isOperatorOpen)}
                                            >
                                                <span>{OPERATOR_OPTIONS.find(o => o.value === (step.operator || 'equals'))?.label || '等於'}</span>
                                                <ChevronDown size={14} className="opacity-50" />
                                            </button>

                                            {isOperatorOpen && (
                                                <>
                                                    <div className="fixed inset-0 z-[50]" onClick={() => setIsOperatorOpen(false)}></div>
                                                    <div className="absolute top-full left-0 min-w-[200px] w-full mt-2 bg-white border border-slate-100 rounded-2xl shadow-xl z-[100] p-2 space-y-1 animate-in fade-in slide-in-from-top-2 custom-scrollbar">
                                                        {OPERATOR_OPTIONS.map((opt) => (
                                                            <button
                                                                key={opt.value}
                                                                type="button"
                                                                className={`w-full text-left px-4 py-3 hover:bg-indigo-50 rounded-xl transition-colors flex items-center justify-between group ${step.operator === opt.value ? 'bg-indigo-50 text-indigo-700' : 'text-slate-700'}`}
                                                                onClick={() => {
                                                                    onUpdate({ operator: opt.value as any });
                                                                    setIsOperatorOpen(false);
                                                                }}
                                                            >
                                                                <span className="text-sm font-bold">{opt.detail}</span>
                                                            </button>
                                                        ))}
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* 值 col-5 */}
                                <div className="col-span-5">
                                    <div className="flex gap-2">
                                        <div className="flex-1 relative">
                                            {step.operator === 'timing-window' ? (
                                                <div className="flex flex-col gap-1.5">
                                                    <div className="flex items-center px-1 h-5 overflow-hidden">
                                                        <label className="text-[12px] font-black text-slate-400 uppercase tracking-widest leading-none">時間區間定義</label>
                                                    </div>
                                                    <div className="flex gap-2 h-[64px]">
                                                        <div className="flex-1 bg-slate-50 border-2 border-transparent rounded-xl px-4 flex items-center text-slate-600 font-bold">
                                                            {(() => {
                                                                const val = step.value || '';

                                                                const refMap: Record<string, string> = {
                                                                    'before-incision': '手術劃刀前',
                                                                    'after-surgery-end': '手術結束後',
                                                                    'after-anesthesia-start': '麻醉開始後',
                                                                    'after-anesthesia-end': '麻醉結束後',
                                                                    'after-admission': '入院後',
                                                                    'before-discharge': '出院前'
                                                                };

                                                                // Handle new format: "0-60-min-before-incision"
                                                                const newMatch = val.match(/^(\d+)-(\d+)-(min|hour|day)-([\w-]+)$/);
                                                                if (newMatch) {
                                                                    const unit = newMatch[3];
                                                                    const unitLabel = unit === 'min' ? '分' : unit === 'hour' ? '小時' : '天';
                                                                    const refLabel = refMap[newMatch[4]] || newMatch[4];
                                                                    return `${newMatch[1]} ~ ${newMatch[2]} ${unitLabel} (${refLabel})`;
                                                                }

                                                                // Fallback to legacy format "0~60:min" or "0-60min-before-incision" (intermediate)
                                                                const legacyMatch = val.match(/^(\d+)-(\d+)(min|hour|day)-([\w-]+)$/); // Intermediate format
                                                                if (legacyMatch) {
                                                                    const unit = legacyMatch[3];
                                                                    const unitLabel = unit === 'min' ? '分' : unit === 'hour' ? '小時' : '天';
                                                                    const refLabel = refMap[legacyMatch[4]] || legacyMatch[4];
                                                                    return `${legacyMatch[1]} ~ ${legacyMatch[2]} ${unitLabel} (${refLabel})`;
                                                                }

                                                                // Legacy default
                                                                const parts = (val.includes(':') ? val : '0~60:min').split(':');
                                                                const range = parts[0] ? parts[0].split('~') : ['0', '60'];
                                                                const unit = parts[1] || 'min';
                                                                const unitLabel = unit === 'min' ? '分' : unit === 'hour' ? '小時' : '天';
                                                                return `${range[0] || 0} ~ ${range[1] || 0} ${unitLabel} (未設定基準)`;
                                                            })()}
                                                        </div>
                                                        <button
                                                            type="button"
                                                            className="px-4 bg-indigo-100 text-indigo-700 rounded-xl font-bold hover:bg-indigo-200 transition-colors shrink-0"
                                                            onClick={() => setIsTimingModalOpen(true)}
                                                        >
                                                            設定
                                                        </button>
                                                    </div>

                                                    {/* Timing Modal */}
                                                    {isTimingModalOpen && (
                                                        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
                                                            <div className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm" onClick={() => setIsTimingModalOpen(false)}></div>
                                                            <div className="bg-white rounded-3xl shadow-2xl p-6 w-full max-w-md relative z-[210] animate-in zoom-in-95">
                                                                <div className="flex justify-between items-center mb-6">
                                                                    <h3 className="text-lg font-black text-slate-800">設定時間區間</h3>
                                                                    <button onClick={() => setIsTimingModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full text-slate-400">
                                                                        <X size={20} />
                                                                    </button>
                                                                </div>

                                                                <div className="space-y-6">
                                                                    {(() => {
                                                                        // Parse current value
                                                                        const val = step.value || '0-60-min-before-incision';
                                                                        let min = '0', max = '60', unit = 'min', ref = 'before-incision';

                                                                        const newMatch = val.match(/^(\d+)-(\d+)-(min|hour|day)-([\w-]+)$/);
                                                                        if (newMatch) {
                                                                            min = newMatch[1]; max = newMatch[2]; unit = newMatch[3]; ref = newMatch[4];
                                                                        } else {
                                                                            const legacyMatch = val.match(/^(\d+)-(\d+)(min|hour|day)-([\w-]+)$/);
                                                                            if (legacyMatch) {
                                                                                min = legacyMatch[1]; max = legacyMatch[2]; unit = legacyMatch[3]; ref = legacyMatch[4];
                                                                            } else {
                                                                                // Legacy default
                                                                                const parts = (val.includes(':') ? val : '0~60:min').split(':');
                                                                                const range = parts[0] ? parts[0].split('~') : ['0', '60'];
                                                                                min = range[0] || '0'; max = range[1] || '60'; unit = parts[1] || 'min';
                                                                                if (unit === 'min' && !parts[1]) unit = 'min'; // default
                                                                            }
                                                                        }

                                                                        const updateTiming = (nMin: string, nMax: string, nUnit: string, nRef: string) => {
                                                                            onUpdate({ value: `${nMin}-${nMax}-${nUnit}-${nRef}` });
                                                                        };

                                                                        return (
                                                                            <>
                                                                                {/* Reference Event Selection */}
                                                                                <div className="space-y-2">
                                                                                    <label className="text-xs font-bold text-slate-400 block uppercase tracking-wide">基準事件 (Reference Event)</label>
                                                                                    <div className="relative">
                                                                                        <select
                                                                                            className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-3 font-bold text-slate-700 outline-none focus:border-indigo-500 appearance-none"
                                                                                            value={ref}
                                                                                            onChange={(e) => updateTiming(min, max, unit, e.target.value)}
                                                                                        >
                                                                                            <option value="before-incision">手術劃刀前 (Before Incision)</option>
                                                                                            <option value="after-surgery-end">手術結束後 (After Surgery End)</option>
                                                                                            <option value="after-anesthesia-start">麻醉開始後 (After Anesthesia Start)</option>
                                                                                            <option value="after-anesthesia-end">麻醉結束後 (After Anesthesia End)</option>
                                                                                            <option value="after-admission">入院後 (After Admission)</option>
                                                                                            <option value="before-discharge">出院前 (Before Discharge)</option>
                                                                                        </select>
                                                                                        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                                                                                    </div>
                                                                                </div>

                                                                                {/* Range Inputs */}
                                                                                <div className="flex items-center gap-4">
                                                                                    <div className="flex-1">
                                                                                        <label className="text-xs font-bold text-slate-400 block mb-1">最小值 (Min)</label>
                                                                                        <input
                                                                                            type="number"
                                                                                            className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl px-4 py-3 font-black text-lg focus:border-indigo-500 outline-none transition-all text-center"
                                                                                            value={min}
                                                                                            onChange={(e) => updateTiming(e.target.value, max, unit, ref)}
                                                                                        />
                                                                                    </div>
                                                                                    <div className="pt-6 font-black text-slate-300">~</div>
                                                                                    <div className="flex-1">
                                                                                        <label className="text-xs font-bold text-slate-400 block mb-1">最大值 (Max)</label>
                                                                                        <input
                                                                                            type="number"
                                                                                            className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl px-4 py-3 font-black text-lg focus:border-indigo-500 outline-none transition-all text-center"
                                                                                            value={max}
                                                                                            onChange={(e) => updateTiming(min, e.target.value, unit, ref)}
                                                                                        />
                                                                                    </div>
                                                                                </div>

                                                                                {/* Unit Selection */}
                                                                                <div>
                                                                                    <label className="text-xs font-bold text-slate-400 block mb-1">時間單位 (Unit)</label>
                                                                                    <div className="grid grid-cols-3 gap-2">
                                                                                        {[
                                                                                            { v: 'min', l: '分 (Min)' },
                                                                                            { v: 'hour', l: '時 (Hr)' },
                                                                                            { v: 'day', l: '天 (Day)' }
                                                                                        ].map(u => (
                                                                                            <button
                                                                                                key={u.v}
                                                                                                type="button"
                                                                                                className={`py-3 rounded-xl font-bold border-2 transition-all ${unit === u.v ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-100 bg-white text-slate-600 hover:border-slate-300'}`}
                                                                                                onClick={() => updateTiming(min, max, u.v, ref)}
                                                                                            >
                                                                                                {u.l}
                                                                                            </button>
                                                                                        ))}
                                                                                    </div>
                                                                                </div>
                                                                            </>
                                                                        );
                                                                    })()}
                                                                </div>

                                                                <div className="mt-8">
                                                                    <button
                                                                        onClick={() => setIsTimingModalOpen(false)}
                                                                        className="w-full bg-slate-900 text-white py-4 rounded-xl font-black text-lg hover:bg-slate-800 transition-all shadow-lg active:scale-95"
                                                                    >
                                                                        確認設定
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                <SearchableDropdown
                                                    label="值 (條件比對)"
                                                    value={step.value || ''}
                                                    placeholder="輸入, AI建議, 或查詢資料庫..."
                                                    options={getCombinedOptions('value')}
                                                    onChange={(v) => onUpdate({ value: v })}
                                                    isMulti={step.operator === 'matchesCode' || step.operator === 'equals'}
                                                    onAiSuggest={() => handleAiSuggest('value')}
                                                    isLoadingAi={isAiLoading === 'value'}
                                                    onFetchValues={handleFetchValues}
                                                    isFetchingValues={isFetchingValues}
                                                />
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : step.valueType === 'indicator_result' ? (
                            <div className="flex gap-2">
                                <div className="flex-1 flex flex-col gap-1.5">
                                    <div className="flex items-center px-1 h-5 overflow-hidden"><label className="text-[12px] font-black text-slate-400 uppercase tracking-widest leading-none">引用目標指標</label></div>
                                    <div className="relative">
                                        <select
                                            className={`w-full bg-slate-50 border-2 border-transparent rounded-xl px-4 py-2 text-[14px] font-black text-slate-700 outline-none focus:border-indigo-500 focus:bg-white transition-all h-[64px] ${step.value === 'CURRENT_DENOMINATOR' ? 'border-indigo-200 bg-indigo-50 text-indigo-700' : ''}`}
                                            value={step.value}
                                            onChange={(e) => onUpdate({ value: e.target.value })}
                                        >
                                            <option value="">選擇現有指標...</option>
                                            {sectionKey === 'num' && (
                                                <option value="CURRENT_DENOMINATOR">★ [本指標] 分母母體 (Current Denominator)</option>
                                            )}
                                            {availableIndicators.map(ind => (
                                                <React.Fragment key={ind.id}>
                                                    <option value={`${ind.id}:num`}>{ind.name} (分子)</option>
                                                    <option value={`${ind.id}:den`}>{ind.name} (分母)</option>
                                                </React.Fragment>
                                            ))}
                                        </select>
                                        {step.value === 'CURRENT_DENOMINATOR' && (
                                            <div className="absolute right-8 top-1/2 -translate-y-1/2 flex items-center gap-2 bg-indigo-600 text-white px-3 py-1.5 rounded-lg shadow-md animate-in fade-in zoom-in-95 pointer-events-none">
                                                <Layers size={12} />
                                                <span className="text-[10px] font-black tracking-widest uppercase">繼承自分母集合</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ) : step.valueType === 'factor' ? (
                            <div className="flex gap-2">
                                <div className="flex-1 flex flex-col gap-1.5">

                                    <SearchableDropdown
                                        label="要素 (Factor)"
                                        value={step.value || ''}
                                        placeholder="請選擇要素..."
                                        options={availableFactors.map(f => ({ value: f.id, label: f.name }))}
                                        onChange={(v) => {
                                            onUpdate({ value: v });
                                        }}
                                        renderSelected={(opt) => opt.label}
                                    />
                                    {/* Auto-Correction for Legacy Name Values */}
                                    {step.value && !availableFactors.find(f => f.id === step.value) && (
                                        <div className="text-[10px] text-amber-500 px-2 mt-1">
                                            {(() => {
                                                // Try to find by name
                                                const match = availableFactors.find(f => f.name === step.value);
                                                if (match) {
                                                    // Auto-update to ID
                                                    setTimeout(() => onUpdate({ value: match.id }), 0);
                                                    return <span>Auto-linking to {match.name}...</span>;
                                                }
                                                return <span>Unrecognized Factor: {step.value}</span>;
                                            })()}
                                        </div>
                                    )}
                                    {/* Show raw ID if it doesn't match a name in the list, to help debug */}
                                    {step.value && !availableFactors.find(f => f.name === step.value) && (
                                        <div className="text-[10px] text-slate-400 px-2">
                                            Original Value: {step.value}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : step.valueType === 'calculated_field' ? (
                            <div className="flex gap-2 h-full items-center">
                                <div className="flex-1 flex flex-col gap-1.5 ">
                                    <div className="flex items-center px-1 h-5 overflow-hidden"><label className="text-[12px] font-black text-slate-400 uppercase tracking-widest leading-none">公式 (Formula)</label></div>
                                    <input type="text" className="w-full bg-slate-50 border-2 border-transparent rounded-xl px-4 py-2 text-[14px] font-black text-slate-700 outline-none focus:border-indigo-500 focus:bg-white transition-all h-[64px]" value={step.path || 'period.end - period.start'} onChange={(e) => onUpdate({ path: e.target.value })} placeholder="e.g. period.end - period.start" />
                                </div>
                                <div className="w-[100px] flex flex-col gap-1.5">
                                    <div className="flex items-center px-1 h-5 overflow-hidden"><label className="text-[12px] font-black text-slate-400 uppercase tracking-widest leading-none">判斷 (Cond)</label></div>
                                    <input type="text" className="w-full bg-slate-50 border-2 border-transparent rounded-xl px-4 py-2 text-[14px] font-black text-slate-700 outline-none focus:border-indigo-500 focus:bg-white transition-all h-[64px]" value={step.value} onChange={(e) => onUpdate({ value: e.target.value })} placeholder="> 24 hours" />
                                </div>
                                <div className="flex items-center pt-6 px-2">
                                    <label className="flex items-center gap-2 cursor-pointer group">
                                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${step.autoHandleNullEnd ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300 bg-white group-hover:border-indigo-400'}`}>
                                            {step.autoHandleNullEnd && <Users size={12} className="text-white" />}
                                        </div>
                                        <input type="checkbox" className="hidden" checked={step.autoHandleNullEnd || false} onChange={(e) => onUpdate({ autoHandleNullEnd: e.target.checked })} />
                                        <span className={`text-xs font-bold select-none ${step.autoHandleNullEnd ? 'text-indigo-700' : 'text-slate-500'}`}>未出院以當前算 (Use Now)</span>
                                    </label>
                                </div>
                            </div>
                        ) : (
                            <div className="flex gap-2">
                                <div className="flex-1 flex flex-col gap-1.5">
                                    <div className="flex items-center px-1 h-5 overflow-hidden"><label className="text-[12px] font-black text-slate-400 uppercase tracking-widest leading-none">自定義常數</label></div>
                                    <input type="number" className="w-full bg-slate-50 border-2 border-transparent rounded-xl px-4 py-2 text-[14px] font-black text-slate-700 outline-none focus:border-indigo-500 focus:bg-white transition-all h-[64px]" value={step.value} onChange={(e) => onUpdate({ value: e.target.value })} placeholder="輸入數值..." />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* 3. 備註 (Notes) - Third Column */}
                    <div className="col-span-1 lg:col-span-2">
                        <div className="flex flex-col gap-1.5">
                            <div className="flex items-center px-1 h-5 overflow-hidden">
                                <label className="text-[12px] font-black text-indigo-600 uppercase tracking-widest leading-none truncate">備註 (Notes)</label>
                            </div>
                            <input
                                type="text"
                                className="w-full bg-indigo-50/30 border-2 border-transparent rounded-xl px-3 py-2 text-[13px] font-bold italic text-slate-700 outline-none focus:border-indigo-500 focus:bg-white transition-all h-[64px] min-w-[50px]"
                                value={step.notes || ''}
                                onChange={(e) => onUpdate({ notes: e.target.value })}
                                placeholder="備註..."
                            />
                        </div>
                    </div>
                </div>

                {/* 4. 刪除按鈕 (Trash) - Placed after Notes */}
                <div className="w-[50px] shrink-0 self-end">
                    <button
                        type="button"
                        onClick={onRemove}
                        className="w-full h-[64px] text-slate-300 hover:text-rose-500 transition-all bg-slate-50 rounded-xl hover:bg-rose-50 border border-transparent hover:border-rose-100 flex items-center justify-center shadow-sm"
                    >
                        <Trash2 size={22} />
                    </button>
                </div>
            </div>
        </div>
    );
};
