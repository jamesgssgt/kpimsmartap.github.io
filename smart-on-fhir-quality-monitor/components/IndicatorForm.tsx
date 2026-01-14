
import React, { useState, useEffect, useRef } from 'react';
import { QualityIndicator, CalculationStep, FhirResource, CalculationAction, ValueType } from '../types';
import { 
  Plus, Trash2, Database, Sparkles, Activity, MessageSquare, Zap, 
  Loader2, Link2, Settings2, X, Info, Code, HelpCircle, 
  Layers, ChevronDown, Brain, Calculator, Hash, Tag, Replace, ArrowRight, Minus, Divide, Percent, Search,
  AlertTriangle, Wand2, Sparkle, Users
} from 'lucide-react';
import { analyzeSectionDefinition, getAiFieldSuggestions, analyzeFullIndicator } from '../services/gemini';

const RESOURCE_CONFIG: Record<FhirResource, { color: string; icon: any; label: string; paths: { value: string; label: string }[] }> = {
  Patient: { 
    color: 'bg-emerald-500', icon: Database, label: '病人資料 (Patient)',
    paths: [
      { value: 'identifier.value', label: '病患代碼 / 病歷號 (Patient ID)' },
      { value: 'identifier.value', label: '身分證號 / 證號 (National ID)' },
      { value: 'name.text', label: '姓名 (name)' },
      { value: 'gender', label: '性別 (gender)' },
      { value: 'birthDate', label: '出生日期 (birthDate)' },
      { value: 'deceasedBoolean', label: '死亡狀態 (deceasedBoolean)' }
    ]
  },
  Observation: { 
    color: 'bg-blue-500', icon: Activity, label: '檢驗檢查 (Observation)',
    paths: [
      { value: 'code.coding.code', label: '檢驗項目代碼 (code)' },
      { value: 'valueQuantity.value', label: '檢驗數值結果 (valueQuantity)' },
      { value: 'status', label: '報告狀態 (status)' },
      { value: 'effectiveDateTime', label: '執行時間 (effectiveDateTime)' }
    ]
  },
  Condition: { 
    color: 'bg-amber-500', icon: Zap, label: '診斷疾病 (Condition)',
    paths: [
      { value: 'code.coding.code', label: '診斷 ICD 代碼 (code)' },
      { value: 'clinicalStatus.coding.code', label: '臨床狀態 (clinicalStatus)' }
    ]
  },
  Procedure: { 
    color: 'bg-indigo-500', icon: Settings2, label: '醫療處置 (Procedure)',
    paths: [
      { value: 'code.coding.code', label: '醫療處置代碼 (code)' },
      { value: 'status', label: '執行狀態 (status)' }
    ]
  },
  Encounter: { 
    color: 'bg-rose-500', icon: MessageSquare, label: '就醫事件 (Encounter)',
    paths: [
      { value: 'class.code', label: '就醫類別 (class)' },
      { value: 'status', label: '當前狀態 (status)' }
    ]
  },
  MedicationRequest: { 
    color: 'bg-purple-500', icon: Sparkles, label: '用藥處方 (MedicationRequest)',
    paths: [
      { value: 'medicationCodeableConcept.coding.code', label: '處方藥品代碼 (medication)' },
      { value: 'status', label: '處方狀態 (status)' }
    ]
  },
};

const ACTION_GROUPS: Record<string, { label: string; actions: CalculationAction[] }> = {
  logical: {
    label: '集合運算',
    actions: ['AND', 'OR', 'NOT']
  },
  arithmetic: {
    label: '數值運算',
    actions: ['ADD', 'SUBTRACT', 'MULTIPLY', 'DIVIDE']
  }
};

const ACTION_MAP: Record<CalculationAction, { label: string; icon: any; color: string; type: 'logical' | 'arithmetic' | 'base' }> = {
  BASE: { label: '起始數據', icon: Database, color: 'bg-slate-900', type: 'base' },
  AND: { label: '集合：且', icon: Layers, color: 'bg-indigo-600', type: 'logical' },
  OR: { label: '集合：或', icon: Layers, color: 'bg-indigo-400', type: 'logical' },
  NOT: { label: '集合：排除', icon: X, color: 'bg-rose-500', type: 'logical' },
  ADD: { label: '數值：加', icon: Plus, color: 'bg-emerald-600', type: 'arithmetic' },
  SUBTRACT: { label: '數值：減', icon: Minus, color: 'bg-orange-600', type: 'arithmetic' },
  MULTIPLY: { label: '數值：乘', icon: X, color: 'bg-amber-600', type: 'arithmetic' },
  DIVIDE: { label: '數值：除', icon: Divide, color: 'bg-cyan-600', type: 'arithmetic' },
};

const SearchableDropdown: React.FC<{
  value: string;
  onChange: (val: string) => void;
  options: { value: string; label: string }[];
  placeholder: string;
  label: string;
  isMulti?: boolean;
  onAiSuggest?: () => void;
  isLoadingAi?: boolean;
}> = ({ value, onChange, options, placeholder, label, isMulti = false, onAiSuggest, isLoadingAi = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const selectedValues = isMulti ? (value ? value.split(',').filter(v => v.trim()) : []) : [value];

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleSelect = (val: string) => {
    if (isMulti) {
      if (!selectedValues.includes(val)) onChange([...selectedValues, val].join(','));
    } else {
      onChange(val);
      setIsOpen(false);
    }
  };

  return (
    <div className="flex flex-col gap-1.5 relative w-full" ref={containerRef}>
      <div className="flex justify-between items-center px-1 h-5 overflow-hidden">
        <label className="text-[12px] font-black text-slate-400 uppercase tracking-widest leading-none truncate">{label}</label>
        {onAiSuggest && (
          <button type="button" onClick={onAiSuggest} disabled={isLoadingAi} className="text-indigo-600 hover:text-indigo-800 flex items-center gap-1 transition-all disabled:opacity-50 group shrink-0 ml-2">
            {isLoadingAi ? <Loader2 size={10} className="animate-spin" /> : <Sparkles size={10} className="group-hover:scale-125 transition-transform" />}
            <span className="text-[9px] font-black uppercase tracking-tighter">AI建議</span>
          </button>
        )}
      </div>
      <div className={`w-full bg-slate-50 border-2 border-transparent rounded-xl px-3 py-2 transition-all group focus-within:border-indigo-500 focus-within:bg-white focus-within:shadow-sm flex flex-wrap gap-2 items-center h-[64px] min-h-[64px] overflow-hidden cursor-pointer`} onClick={() => setIsOpen(true)}>
        {isMulti && selectedValues.length > 0 ? (
          <div className="flex flex-wrap gap-1 overflow-y-auto max-h-[48px] pr-1 custom-scrollbar w-full">
            {selectedValues.map(v => (
              <div key={v} className="bg-indigo-600 text-white px-2 py-0.5 rounded-lg flex items-center gap-1 text-[10px] font-black shadow-sm shrink-0">
                <span className="truncate max-w-[100px]">{options.find(o => o.value === v)?.label || v}</span>
                <button type="button" onClick={(e) => { e.stopPropagation(); onChange(selectedValues.filter(x => x !== v).join(',')); }} className="hover:text-indigo-200"><X size={12} /></button>
              </div>
            ))}
          </div>
        ) : (
          <span className={`text-[14px] font-bold truncate ${value ? 'text-slate-700' : 'text-slate-300'}`}>
            {options.find(o => o.value === value)?.label || value || placeholder}
          </span>
        )}
        <div className="ml-auto pl-1 text-slate-300 shrink-0"><ChevronDown size={16} className={isOpen ? 'rotate-180' : ''} /></div>
      </div>
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-100 rounded-2xl shadow-2xl z-[100] max-h-60 overflow-y-auto p-2 space-y-1 animate-in fade-in slide-in-from-top-2 custom-scrollbar">
          {options.length > 0 ? options.map(opt => (
            <button key={opt.value} type="button" className="w-full text-left px-4 py-3 hover:bg-indigo-50 rounded-xl transition-colors flex flex-col group" onClick={() => handleSelect(opt.value)}>
              <span className="text-sm font-bold text-slate-700 group-hover:text-indigo-700">{opt.label}</span>
              <span className="text-[10px] font-mono text-slate-400 group-hover:text-indigo-400">{opt.value}</span>
            </button>
          )) : (
            <div className="p-6 text-center text-slate-400 text-xs italic font-medium">尚無建議內容...</div>
          )}
        </div>
      )}
    </div>
  );
};

const CriterionRow: React.FC<{
  step: CalculationStep;
  onUpdate: (updates: Partial<CalculationStep>) => void;
  onRemove: () => void;
  availableIndicators: QualityIndicator[];
  indicatorContext: { name: string; description: string };
}> = ({ step, onUpdate, onRemove, availableIndicators, indicatorContext }) => {
  const isBase = step.action === 'BASE';
  const actionInfo = ACTION_MAP[step.action];
  const [isAiLoading, setIsAiLoading] = useState<'path' | 'value' | null>(null);
  const [aiSuggestions, setAiSuggestions] = useState<{ path: any[]; value: any[] }>({ path: [], value: [] });

  const handleAiSuggest = async (type: 'path' | 'value') => {
    if (type === 'value' && !step.path) return alert("請先選擇欄位路徑。");
    setIsAiLoading(type);
    try {
      const res = await getAiFieldSuggestions(type, { ...indicatorContext, resourceType: step.resourceType || 'Observation', path: step.path });
      setAiSuggestions(prev => ({ ...prev, [type]: res }));
    } catch (e) { alert("智慧建議獲取失敗。"); }
    finally { setIsAiLoading(null); }
  };

  const getCombinedOptions = (type: 'path' | 'value') => {
    if (type === 'path') {
      const basePaths = step.resourceType ? RESOURCE_CONFIG[step.resourceType].paths : [];
      return [...basePaths, ...aiSuggestions.path];
    }
    return [...aiSuggestions.value];
  };

  return (
    <div className="relative mb-8 last:mb-0 animate-in slide-in-from-left-4">
      {!isBase && (
        <div className="flex justify-center -mt-6 mb-6 relative z-20">
          <div className="flex bg-white p-2 rounded-2xl border-2 border-slate-100 shadow-xl gap-6 px-6 ring-4 ring-white/90">
            {Object.entries(ACTION_GROUPS).map(([groupKey, group]) => (
              <div key={groupKey} className="flex flex-col gap-1.5">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">{group.label}</span>
                <div className="flex gap-1.5">
                  {group.actions.map(a => (
                    <button 
                      key={a} type="button" onClick={() => onUpdate({ action: a })}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-black transition-all flex items-center gap-1.5 ${step.action === a ? `${ACTION_MAP[a].color} text-white shadow-lg` : 'text-slate-400 hover:bg-slate-50'}`}
                    >
                      {React.createElement(ACTION_MAP[a].icon, { size: 12 })} {ACTION_MAP[a].label.split('：')[1]}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className={`flex flex-col lg:flex-row items-center gap-4 bg-white p-3 rounded-2xl border transition-all hover:shadow-xl ${isBase ? 'border-slate-300 ring-[4px] ring-slate-100 shadow-sm' : 'border-slate-100 shadow-sm'}`}>
        <div className={`w-16 h-[64px] ${actionInfo.color} text-white rounded-xl flex items-center justify-center shrink-0 shadow-md`}>
          {React.createElement(actionInfo.icon, { size: 28 })}
        </div>

        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 items-end">
          {/* 引用來源 (2/12) */}
          <div className="lg:col-span-2 flex flex-col gap-1.5">
            <div className="flex items-center px-1 h-5 overflow-hidden"><label className="text-[12px] font-black text-slate-400 uppercase tracking-widest leading-none">引用來源</label></div>
            <select 
              className="w-full bg-slate-50 border-2 border-transparent rounded-xl px-3 py-2 text-[14px] font-black text-slate-700 outline-none focus:border-indigo-500 focus:bg-white transition-all cursor-pointer h-[64px]"
              value={step.valueType}
              onChange={(e) => onUpdate({ valueType: e.target.value as ValueType, value: '', path: '' })}
            >
              <option value="fhir_filter">A - FHIR 過濾</option>
              <option value="indicator_result">B - 引用指標</option>
              <option value="constant">C - 常數</option>
            </select>
          </div>

          {/* FHIR 邏輯區 (8/12 - 包含 資源, 路徑, 值) */}
          <div className="lg:col-span-8">
            {step.valueType === 'fhir_filter' ? (
              <div className="grid grid-cols-12 gap-4 items-end">
                {/* 資源類型：寬度足以容納四個中文字 */}
                <div className="col-span-2 flex flex-col gap-1.5">
                  <div className="flex items-center px-1 h-5 overflow-hidden"><label className="text-[12px] font-black text-slate-400 uppercase tracking-widest leading-none">資源類型</label></div>
                  <select 
                    className="w-full bg-slate-50 border-2 border-transparent rounded-xl px-2 py-2 text-[14px] font-bold text-slate-700 outline-none focus:border-indigo-500 focus:bg-white transition-all h-[64px]"
                    value={step.resourceType}
                    onChange={(e) => onUpdate({ resourceType: e.target.value as FhirResource, path: '' })}
                  >
                    {Object.entries(RESOURCE_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label.split(' ')[0]}</option>)}
                  </select>
                </div>
                {/* 欄位路徑 */}
                <div className="col-span-4">
                  <SearchableDropdown label="欄位路徑" value={step.path || ''} placeholder="路徑..." options={getCombinedOptions('path')} onChange={(v) => onUpdate({ path: v })} onAiSuggest={() => handleAiSuggest('path')} isLoadingAi={isAiLoading === 'path'} />
                </div>
                {/* 值 */}
                <div className="col-span-6">
                  <SearchableDropdown label="值 (條件比對)" value={step.value || ''} placeholder="輸入或智慧建議值..." options={getCombinedOptions('value')} onChange={(v) => onUpdate({ value: v })} isMulti={true} onAiSuggest={() => handleAiSuggest('value')} isLoadingAi={isAiLoading === 'value'} />
                </div>
              </div>
            ) : step.valueType === 'indicator_result' ? (
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center px-1 h-5 overflow-hidden"><label className="text-[12px] font-black text-slate-400 uppercase tracking-widest leading-none">引用目標指標</label></div>
                <select className="w-full bg-slate-50 border-2 border-transparent rounded-xl px-4 py-2 text-[14px] font-black text-slate-700 outline-none focus:border-indigo-500 focus:bg-white transition-all h-[64px]" value={step.value} onChange={(e) => onUpdate({ value: e.target.value })}>
                  <option value="">選擇現有指標...</option>
                  {availableIndicators.map(ind => (
                    <React.Fragment key={ind.id}>
                      <option value={`${ind.id}:num`}>{ind.name} (分子)</option>
                      <option value={`${ind.id}:den`}>{ind.name} (分母)</option>
                    </React.Fragment>
                  ))}
                </select>
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center px-1 h-5 overflow-hidden"><label className="text-[12px] font-black text-slate-400 uppercase tracking-widest leading-none">自定義常數</label></div>
                <input type="number" className="w-full bg-slate-50 border-2 border-transparent rounded-xl px-4 py-2 text-[14px] font-black text-slate-700 outline-none focus:border-indigo-500 focus:bg-white transition-all h-[64px]" value={step.value} onChange={(e) => onUpdate({ value: e.target.value })} placeholder="輸入數值..." />
              </div>
            )}
          </div>

          {/* 備註填寫區 (2/12) */}
          <div className="lg:col-span-2 flex flex-col gap-1.5 overflow-hidden">
            <div className="flex items-center px-1 h-5 overflow-hidden"><label className="text-[12px] font-black text-indigo-600 uppercase tracking-widest leading-none truncate">備註填寫區</label></div>
            <div className="flex items-center gap-2 overflow-hidden">
              <input type="text" className="flex-1 bg-indigo-50/30 border-2 border-transparent rounded-xl px-3 py-2 text-[13px] font-bold italic text-slate-700 outline-none focus:border-indigo-500 focus:bg-white transition-all h-[64px] min-w-0" value={step.notes || ''} onChange={(e) => onUpdate({ notes: e.target.value })} placeholder="邏輯說明..." />
              <button type="button" onClick={onRemove} className="p-3 text-slate-300 hover:text-rose-500 transition-all shrink-0 bg-slate-50 rounded-xl hover:bg-rose-50 border border-transparent hover:border-rose-100 flex items-center justify-center h-[64px] w-[50px]"><Trash2 size={22} /></button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

interface Props {
  onSave: (indicator: QualityIndicator) => void;
  onCancel: () => void;
  initialData?: QualityIndicator | null;
  availableIndicators?: QualityIndicator[];
}

export const IndicatorForm: React.FC<Props> = ({ onSave, onCancel, initialData, availableIndicators = [] }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [numeratorSteps, setNumeratorSteps] = useState<CalculationStep[]>([]);
  const [denominatorSteps, setDenominatorSteps] = useState<CalculationStep[]>([]);
  const [exclusionSteps, setExclusionSteps] = useState<CalculationStep[]>([]);
  const [numDraft, setNumDraft] = useState('');
  const [denDraft, setDenDraft] = useState('');
  const [exDraft, setExDraft] = useState('');
  const [isLoading, setIsLoading] = useState<'num' | 'den' | 'ex' | 'full' | null>(null);
  const [saveAttempted, setSaveAttempted] = useState(false);
  
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (initialData) {
      setName(initialData.name);
      setDescription(initialData.description);
      setNumeratorSteps(initialData.numeratorSteps || []);
      setDenominatorSteps(initialData.denominatorSteps || []);
      setExclusionSteps(initialData.exclusionSteps || []);
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
    } catch (e) {
      alert("智慧建議生成失敗，請稍後再試。");
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
    } catch (e) { alert("分析失敗。"); }
    finally { setIsLoading(null); }
  };

  const handleSave = () => {
    setSaveAttempted(true);
    if (!name.trim()) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      setTimeout(() => nameInputRef.current?.focus(), 500);
      return;
    }
    onSave({ 
      id: initialData?.id || Math.random().toString(36).substr(2, 9), 
      name, description, numeratorSteps, denominatorSteps, exclusionSteps, 
      frequency: '每月' 
    });
  };

  const Section = ({ title, steps, setSteps, draft, setDraft, sectionKey, color, icon: Icon, placeholder }: any) => (
    <div className={`p-6 md:p-8 rounded-3xl border shadow-sm space-y-6 ${color}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-white shadow-lg ${color.replace('border-', 'bg-').replace('/20', '')}`}>
            <Icon size={32} />
          </div>
          <div>
            <h3 className="font-black text-2xl text-slate-900 tracking-tight">{title}</h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">指標架構設計</p>
          </div>
        </div>
        {(sectionKey === 'num' || sectionKey === 'den') && (
           <div className="flex items-center gap-2 bg-indigo-50 px-4 py-2 rounded-xl border border-indigo-100 animate-pulse">
             <Wand2 size={16} className="text-indigo-600" />
             <span className="text-[11px] font-black text-indigo-600 uppercase">智慧建議功能已啟動</span>
           </div>
        )}
      </div>
      <div className="bg-white/60 p-4 rounded-2xl border-2 border-dashed border-slate-200 space-y-3">
        <div className="flex justify-between items-center px-1">
          <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest">描述邏輯說明</label>
        </div>
        <div className="flex gap-4">
          <textarea className="flex-1 bg-white rounded-xl p-4 text-[14px] font-bold border-2 border-slate-100 focus:border-indigo-500 outline-none h-24 shadow-inner resize-none transition-all placeholder:text-slate-300 custom-scrollbar" placeholder={placeholder} value={draft} onChange={(e) => setDraft(e.target.value)} />
          <button type="button" onClick={() => handleSmartAnalyze(sectionKey)} disabled={isLoading === sectionKey || !draft.trim()} className="px-6 bg-slate-900 text-white rounded-2xl font-black text-sm shadow-xl hover:bg-slate-800 transition disabled:opacity-50 flex flex-col items-center justify-center gap-2 group min-w-[140px]">
            {isLoading === sectionKey ? <Loader2 className="animate-spin" /> : <Brain size={24} className="group-hover:scale-110 transition-transform" />}
            智慧建議
          </button>
        </div>
      </div>
      <div className="space-y-3">
        {steps.map((s: any) => (
          <CriterionRow key={s.id} step={s} availableIndicators={availableIndicators} onRemove={() => setSteps(steps.filter((x: any) => x.id !== s.id))} onUpdate={(u) => setSteps(steps.map((x: any) => x.id === s.id ? {...x, ...u} : x))} indicatorContext={{ name, description }} />
        ))}
        <button type="button" onClick={() => handleAddStep(sectionKey)} className="w-full py-6 border-2 border-dashed border-slate-200 rounded-2xl text-slate-400 font-black hover:bg-white hover:border-indigo-300 hover:text-indigo-500 flex items-center justify-center gap-3 transition-all group text-base shadow-inner">
          <Plus size={20} className="group-hover:rotate-90 transition-transform" /> 手動新增運算步驟
        </button>
      </div>
    </div>
  );

  return (
    <div className="bg-white p-6 md:p-10 rounded-[2.5rem] border-2 border-slate-100 shadow-2xl relative pb-32 mx-[2px] max-w-[calc(100%-4px)] overflow-hidden animate-in fade-in slide-in-from-bottom-8 duration-700">
      <div className="absolute top-0 left-0 w-full h-4 bg-indigo-600"></div>
      
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
            <button 
              type="button" 
              onClick={handleFullIndicatorSuggest}
              disabled={isLoading === 'full'}
              className="px-8 bg-indigo-600 text-white rounded-2xl font-black text-sm shadow-xl hover:bg-indigo-700 transition flex items-center gap-3 disabled:opacity-50 shrink-0 group h-full"
            >
              {isLoading === 'full' ? <Loader2 className="animate-spin" size={20} /> : <Sparkle size={20} className="group-hover:rotate-12 transition-transform" />}
              智慧建議
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-12">
        <Section title="排除個案 (Exclusions)" sectionKey="ex" steps={exclusionSteps} setSteps={setExclusionSteps} draft={exDraft} setDraft={setExDraft} color="border-rose-100 bg-rose-50/20" icon={X} placeholder="輸入排除條件..." />
        <Section title="分母母體 (Denominator)" sectionKey="den" steps={denominatorSteps} setSteps={setDenominatorSteps} draft={denDraft} setDraft={setDenDraft} color="border-slate-100 bg-slate-50/30" icon={Users} placeholder="輸入分母條件，AI 將協助自動填寫運算邏輯..." />
        <Section title="分子合格 (Numerator)" sectionKey="num" steps={numeratorSteps} setSteps={setNumeratorSteps} draft={numDraft} setDraft={setNumDraft} color="border-indigo-100 bg-indigo-50/20" icon={Calculator} placeholder="輸入合格條件，AI 將協助自動填寫運算邏輯..." />
      </div>

      <div className="mt-20 flex flex-col md:flex-row justify-end items-center gap-10 border-t pt-12">
        <div className="flex items-center gap-5 text-slate-400 text-sm font-bold bg-slate-50 px-8 py-5 rounded-2xl border border-slate-100 shadow-sm">
          <Percent size={28} className="text-indigo-600" />
          <div className="flex flex-col">
            <span className="text-slate-400 text-[9px] uppercase font-black tracking-widest mb-0.5">達成率公式</span>
            <span className="text-slate-900 font-black text-lg tracking-tighter">( 分子 / 分母 ) × 100%</span>
          </div>
        </div>
        <div className="flex gap-6 w-full md:w-auto">
          <button type="button" onClick={onCancel} className="flex-1 md:flex-none px-10 py-6 text-slate-400 hover:text-slate-800 font-black text-xl transition-colors">取消</button>
          <button type="button" onClick={handleSave} className="flex-1 md:flex-none px-20 py-8 bg-slate-900 text-white rounded-[2rem] font-black hover:bg-indigo-600 shadow-2xl transition-all text-2xl active:scale-95">
            儲存指標設定
          </button>
        </div>
      </div>
    </div>
  );
};
