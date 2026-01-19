"use client";

import React, { useState } from 'react';
import { Search, Settings2, X, Database, Plus, Activity, HelpCircle, Loader2 } from 'lucide-react';

export const SearchableDropdown: React.FC<{
    value: string;
    onChange: (val: string) => void;
    options: { value: string; label: string }[];
    placeholder: string;
    label: string;
    isMulti?: boolean;
    onAiSuggest?: () => void;
    isLoadingAi?: boolean;
    enableAi?: boolean;
    onFetchValues?: (searchTerm?: string) => void;
    isFetchingValues?: boolean;
    renderSelected?: (option: { value: string; label: string }) => string;
}> = ({ value, onChange, options, placeholder, label, isMulti = false, onAiSuggest, isLoadingAi = false, enableAi = false, onFetchValues, isFetchingValues = false, renderSelected }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const processedSelectedValues = value ? value.split(',') : [];
    const selectedValues = isMulti ? processedSelectedValues : [];

    const filteredOptions = options.filter(o =>
        o.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
        o.value.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleSelect = (val: string) => {
        if (isMulti) {
            const current = value ? value.split(',') : [];
            const newValues = current.includes(val) ? current.filter(v => v !== val) : [...current, val];
            onChange(newValues.join(','));
        } else {
            onChange(val);
            setIsModalOpen(false);
        }
    };

    return (
        <div className="flex flex-col gap-1.5 relative group">
            <div className="flex justify-between items-end px-1 h-5 overflow-hidden">
                <label className="text-[12px] font-black text-slate-500 uppercase tracking-widest leading-none truncate">{label}</label>
                <div className="flex items-center">
                    {onFetchValues && (
                        <button type="button" onClick={(e) => { e.stopPropagation(); setIsModalOpen(true); }} className="text-emerald-600 hover:text-emerald-800 flex items-center gap-1 transition-all group shrink-0 ml-2">
                            <Search size={12} className="group-hover:scale-125 transition-transform" />
                            <span className="text-[11px] font-black uppercase tracking-tighter">FHIR查詢</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Display View - Fixed Single Line */}
            <div
                className="w-full bg-slate-50 border-2 border-transparent rounded-xl px-4 py-3 transition-all cursor-pointer hover:bg-white hover:border-indigo-100 flex items-center h-[64px] relative group"
                onClick={() => setIsModalOpen(true)}
            >
                <div className="flex-1 flex gap-2 items-center overflow-hidden pr-6">
                    {selectedValues.length > 0 ? (
                        <div className="flex gap-2 items-center flex-nowrap overflow-hidden">
                            {selectedValues.slice(0, 3).map(v => (
                                <div key={v} className="bg-indigo-600 text-white px-2 py-0.5 rounded-lg text-[10px] font-black shrink-0">
                                    {renderSelected
                                        ? renderSelected({ value: v, label: options.find(o => o.value === v)?.label || v })
                                        : (options.find(o => o.value === v)?.label || v)}
                                </div>
                            ))}
                            {selectedValues.length > 3 && (
                                <span className="text-[10px] font-black text-slate-400 shrink-0">...等 {selectedValues.length} 項</span>
                            )}
                        </div>
                    ) : (
                        <span className={`text-[14px] font-bold truncate ${value ? 'text-slate-700' : 'text-slate-300'}`}>
                            {value
                                ? (renderSelected
                                    ? renderSelected({ value: value, label: options.find(o => o.value === value)?.label || value })
                                    : (options.find(o => o.value === value)?.label || value))
                                : placeholder}
                        </span>
                    )}
                </div>
                <div className="text-slate-300 shrink-0 group-hover:text-indigo-400 transition-colors">
                    <Settings2 size={16} />
                </div>
            </div>

            {/* Selection Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6">
                    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-in fade-in" onClick={() => setIsModalOpen(false)}></div>

                    <div className="relative bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-100 flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200">
                        {/* Header */}
                        <div className="p-6 border-b border-slate-50 flex justify-between items-center">
                            <div>
                                <h3 className="text-xl font-black text-slate-800 flex items-center gap-2">
                                    <Database className="text-indigo-600" size={24} />
                                    {label} 管理 ({filteredOptions.length}/{options.length})
                                </h3>
                                <p className="text-xs font-bold text-slate-400 mt-1 italic">搜尋並選擇所需內容</p>
                            </div>
                            <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-rose-50 hover:text-rose-500 rounded-full transition-colors text-slate-400">
                                <X size={24} />
                            </button>
                        </div>

                        {/* Search Bar & Add Custom Button (Sticky Area) */}
                        <div className="p-6 bg-slate-50/50 border-b border-slate-100 flex flex-col gap-4">
                            <div className="flex justify-between items-end">
                                <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest pl-1">搜尋與操作</label>
                                {isMulti && filteredOptions.length > 0 && (
                                    <button
                                        type="button"
                                        className="text-[12px] font-black text-indigo-600 hover:text-indigo-800 flex items-center gap-1 transition-all bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-100 shadow-sm active:scale-95"
                                        onClick={() => {
                                            const newValues = Array.from(new Set([...selectedValues, ...filteredOptions.map(o => o.value)]));
                                            onChange(newValues.join(','));
                                        }}
                                    >
                                        <Plus size={14} /> 全選目前結果 ({filteredOptions.length} 筆)
                                    </button>
                                )}
                            </div>

                            <div className="relative">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                <input
                                    autoFocus
                                    type="text"
                                    className="w-full bg-white border-2 border-transparent rounded-2xl pl-12 pr-4 py-4 text-lg font-bold text-slate-700 shadow-sm focus:border-indigo-500 outline-none transition-all"
                                    placeholder="輸入關鍵字搜尋..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                                {onFetchValues && (
                                    <button
                                        onClick={() => onFetchValues(searchTerm)}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 bg-emerald-600 text-white px-4 py-2 rounded-xl text-xs font-black hover:bg-emerald-700 transition-colors flex items-center gap-1 shadow-md"
                                    >
                                        {isFetchingValues ? <Loader2 size={14} className="animate-spin" /> : <Database size={14} />}
                                        FHIR 查詢
                                    </button>
                                )}
                            </div>

                            {/* Always show "Add Custom" if searchTerm is not empty and not already selected */}
                            {searchTerm && !selectedValues.includes(searchTerm) && (
                                <button
                                    type="button"
                                    className="w-full mt-4 text-left p-4 rounded-2xl bg-emerald-50 border-2 border-emerald-200 hover:border-emerald-300 transition-all flex items-center justify-between group shadow-sm animate-in slide-in-from-top-2"
                                    onClick={() => { handleSelect(searchTerm); setSearchTerm(''); }}
                                >
                                    <div className="flex flex-col">
                                        <span className="text-sm font-black text-emerald-700 flex items-center gap-2">
                                            <Plus size={16} /> 使用自定義輸入："{searchTerm}"
                                        </span>
                                        <span className="text-[10px] font-mono text-emerald-500 uppercase mt-1">手動新增此值至清單</span>
                                    </div>
                                    <div className="bg-emerald-600 text-white rounded-full p-1 animate-pulse">
                                        <Plus size={14} />
                                    </div>
                                </button>
                            )}
                        </div>


                        {/* Options List */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">

                            {filteredOptions.length > 0 ? (
                                <>
                                    <div className="grid grid-cols-1 gap-2">
                                        {filteredOptions.map(opt => (
                                            <button
                                                key={opt.value}
                                                type="button"
                                                className={`w-full text-left p-4 rounded-2xl transition-all flex items-center justify-between group border-2 ${selectedValues.includes(opt.value) ? 'bg-indigo-50 border-indigo-200' : 'bg-white border-transparent hover:border-slate-100 hover:bg-slate-50'}`}
                                                onClick={() => handleSelect(opt.value)}
                                            >
                                                <div className="flex flex-col">
                                                    <span className={`text-sm font-bold ${selectedValues.includes(opt.value) ? 'text-indigo-700' : 'text-slate-700 group-hover:text-indigo-600'}`}>{opt.label}</span>
                                                    <span className="text-[10px] font-mono text-slate-400 uppercase mt-1">{opt.value}</span>
                                                </div>
                                                {selectedValues.includes(opt.value) && (
                                                    <div className="bg-indigo-600 text-white rounded-full p-1">
                                                        <Activity size={14} />
                                                    </div>
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                </>
                            ) : (
                                <div className="py-20 flex flex-col items-center justify-center text-slate-300">
                                    <HelpCircle size={48} className="mb-4 opacity-20" />
                                    <p className="font-bold">找不到相符選項</p>
                                    {searchTerm && (
                                        <button
                                            onClick={() => { handleSelect(searchTerm); setSearchTerm(''); }}
                                            className="mt-4 text-indigo-600 font-black hover:underline"
                                        >
                                            使用自定義內容 "{searchTerm}"
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Selected Tray (Persistent at Bottom) */}
                        {isMulti && selectedValues.length > 0 && (
                            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/80">
                                <div className="flex justify-between items-center mb-3">
                                    <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">已選擇的項目 ({selectedValues.length})</label>
                                    <button
                                        onClick={() => onChange('')}
                                        className="text-[10px] font-black text-rose-500 hover:text-rose-700 uppercase tracking-tighter"
                                    >
                                        全部清除
                                    </button>
                                </div>
                                <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto custom-scrollbar p-1">
                                    {selectedValues.map(v => (
                                        <div key={v} className="bg-indigo-600 text-white pl-3 pr-2 py-1.5 rounded-xl flex items-center gap-2 text-xs font-black shadow-sm group animate-in zoom-in-95">
                                            <span>{options.find(o => o.value === v)?.label || v}</span>
                                            <button
                                                onClick={() => handleSelect(v)}
                                                className="hover:bg-indigo-700 rounded-lg p-0.5 transition-colors"
                                            >
                                                <X size={14} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Footer (Actions) */}
                        <div className="p-6 border-t border-slate-100 bg-slate-50 rounded-b-3xl flex justify-end">
                            <button onClick={() => setIsModalOpen(false)} className="px-6 py-3 bg-slate-900 text-white rounded-xl font-black text-sm hover:bg-slate-800 transition-all shadow-lg active:scale-95">
                                完成
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
