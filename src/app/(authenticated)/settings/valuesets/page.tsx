"use client";

import React, { useState, useEffect } from 'react';
import { Database, Plus, Trash2, Search, ArrowLeft, Loader2, Save, X, Pencil, Check } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { getValueSets, getValueSetCodes, addValueSetCode, removeValueSetCode, updateValueSetDetails, updateValueSetCode, ValueSetGroup, ValueSetItem } from '@/app/actions/valuesets';

export default function ValueSetsPage() {
    const router = useRouter();
    const [groups, setGroups] = useState<ValueSetGroup[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedSet, setSelectedSet] = useState<string | null>(null);
    const [codes, setCodes] = useState<ValueSetItem[]>([]);
    const [loadingCodes, setLoadingCodes] = useState(false);

    // New Set State
    const [isCreatingSet, setIsCreatingSet] = useState(false);
    const [newSetId, setNewSetId] = useState('');
    const [newSetResource, setNewSetResource] = useState('');
    const [newSetName, setNewSetName] = useState(''); // NEW

    // New Code State
    const [isAddingCode, setIsAddingCode] = useState(false);
    const [newCode, setNewCode] = useState({ code: '', display: '', system: '', hospital_code: '' }); // ADDED hospital_code

    // Edit Set State
    const [isEditingSet, setIsEditingSet] = useState(false);
    const [editSetName, setEditSetName] = useState('');

    // Edit List Item State
    const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
    const [editingGroupName, setEditingGroupName] = useState('');

    // Edit Code Item State
    const [editingCodeId, setEditingCodeId] = useState<number | null>(null);
    const [editingCodeData, setEditingCodeData] = useState<Partial<ValueSetItem>>({});

    useEffect(() => {
        loadGroups();
    }, []);

    useEffect(() => {
        if (selectedSet) {
            loadCodes(selectedSet);
        }
    }, [selectedSet]);

    async function loadGroups() {
        setLoading(true);
        const res = await getValueSets();
        setGroups(res);
        setLoading(false);
    }

    async function loadCodes(setId: string) {
        setLoadingCodes(true);
        const res = await getValueSetCodes(setId);
        setCodes(res);
        setLoadingCodes(false);
        // Sync local edit state
        const currentGroup = groups.find(g => g.set_id === setId);
        if (currentGroup) setEditSetName(currentGroup.set_name || '');
    }

    async function handleRefesh() {
        if (selectedSet) loadCodes(selectedSet);
        else loadGroups();
    }

    async function handleAddCode() {
        if (!newCode.code || !selectedSet) return;
        const currentGroup = groups.find(g => g.set_id === selectedSet);
        await addValueSetCode({
            set_id: selectedSet,
            set_name: currentGroup?.set_name || undefined, // Persist name on new rows
            code: newCode.code,
            display: newCode.display,
            system: newCode.system || undefined,
            hospital_code: newCode.hospital_code || undefined, // ADDED
            resource_path: currentGroup?.description || undefined // Reuse 'description' as resource_path valid logic
        });
        setNewCode({ code: '', display: '', system: '', hospital_code: '' }); // RESET
        setIsAddingCode(false);
        handleRefesh();
    }

    async function handleRemoveCode(id: number) {
        if (!confirm("確定刪除此代碼?")) return;
        await removeValueSetCode(id);
        handleRefesh();
    }

    async function handleCreateSet() {
        if (!newSetId) return;
        // Just switch view, actual creation happens on first code add usually, 
        // but for UX we can add a dummy code or just let them add.
        // Let's just enter "Edit Mode" for this new set ID (empty codes)
        setSelectedSet(newSetId);
        // We might want to persist the "resource path/description" for the group first? 
        // The table stores it per row. So it will be attached to the first code.
        setGroups([...groups, {
            set_id: newSetId,
            set_name: newSetName, // NEW
            total_codes: 0,
            last_updated: new Date().toISOString(),
            description: newSetResource
        }]);
        setIsCreatingSet(false);
        setIsCreatingSet(false);
    }

    async function handleUpdateSet() {
        if (!selectedSet || !editSetName) return;
        setLoadingCodes(true);
        await updateValueSetDetails(selectedSet, editSetName);
        // Refresh local data
        await loadGroups();
        setIsEditingSet(false);
        setIsEditingSet(false);
        setLoadingCodes(false);
    }

    async function handleUpdateCode(id: number) {
        if (!editingCodeId || editingCodeId !== id) return;
        setLoadingCodes(true);
        await updateValueSetCode(id, editingCodeData);
        if (selectedSet) await loadCodes(selectedSet);
        setEditingCodeId(null);
        setLoadingCodes(false);
    }

    async function handleUpdateGroup(e: React.MouseEvent, id: string) {
        e.stopPropagation();
        if (!id || !editingGroupName) return;
        setLoading(true); // global loading for list refresh
        await updateValueSetDetails(id, editingGroupName);
        await loadGroups();
        setEditingGroupId(null);
        setLoading(false);
    }

    return (
        <div className="min-h-screen bg-slate-50 md:p-12 p-6 animate-in fade-in">
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="flex items-center gap-4 mb-8">
                    <button onClick={() => selectedSet ? setSelectedSet(null) : router.back()} className="p-3 hover:bg-slate-200 rounded-full transition-colors text-slate-500">
                        <ArrowLeft size={24} />
                    </button>
                    <div>
                        <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                            <Database className="text-indigo-600" />
                            {selectedSet ? (
                                <span className="flex items-center gap-3">
                                    {selectedSet}
                                    {isEditingSet ? (
                                        <div className="flex items-center gap-2">
                                            <input
                                                autoFocus
                                                value={editSetName}
                                                onChange={e => setEditSetName(e.target.value)}
                                                className="text-lg font-bold text-slate-600 border-b-2 border-indigo-500 outline-none bg-transparent px-1 min-w-[200px]"
                                            />
                                            <button onClick={handleUpdateSet} className="p-1 hover:bg-emerald-100 text-emerald-600 rounded-full">
                                                <Check size={20} />
                                            </button>
                                            <button onClick={() => { setIsEditingSet(false); setEditSetName(groups.find(g => g.set_id === selectedSet)?.set_name || ''); }} className="p-1 hover:bg-rose-100 text-rose-500 rounded-full">
                                                <X size={20} />
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-2 group/edit">
                                            <span className={`text-lg font-bold ml-3 ${!groups.find(g => g.set_id === selectedSet)?.set_name ? 'text-slate-300 italic' : 'text-slate-400'}`}>
                                                {groups.find(g => g.set_id === selectedSet)?.set_name || '點擊設定名稱'}
                                            </span>
                                            <button onClick={() => { setIsEditingSet(true); setEditSetName(groups.find(g => g.set_id === selectedSet)?.set_name || ''); }} className="p-1.5 bg-slate-100 text-slate-400 rounded-full hover:bg-slate-200 transition-all">
                                                <Pencil size={16} />
                                            </button>
                                        </div>
                                    )}
                                </span>
                            ) : '專有名詞管理 (ValueSets)'}
                        </h1>
                        <p className="text-slate-500 font-bold mt-1">
                            {selectedSet ? '管理此值集包含的 FHIR 代碼定義與院內對應' : '管理系統中使用的 FHIR ValueSets 與代碼對照表'}
                        </p>
                    </div>
                </div>

                <div className="bg-white rounded-[2.5rem] shadow-xl border border-slate-100 overflow-hidden min-h-[500px]">
                    {!selectedSet ? (
                        // List View
                        <div className="p-8">
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-xl font-black text-slate-800">現有值集列表</h2>
                                <button
                                    onClick={() => setIsCreatingSet(true)}
                                    className="px-6 py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-colors flex items-center gap-2 shadow-lg"
                                >
                                    <Plus size={20} />
                                    新增值集
                                </button>
                            </div>

                            {isCreatingSet && (
                                <div className="mb-8 bg-indigo-50 p-6 rounded-2xl border-2 border-indigo-100 animate-in slide-in-from-top-4">
                                    <div className="flex gap-4 items-end flex-wrap">
                                        <div className="flex-1 min-w-[200px]">
                                            <label className="text-xs font-bold text-slate-500 uppercase">值集代碼 (Set ID)</label>
                                            <input
                                                autoFocus
                                                className="w-full mt-1 px-4 py-3 rounded-xl border border-indigo-200 font-bold outline-none ring-2 ring-transparent focus:ring-indigo-300"
                                                placeholder="e.g. Vanco_Fluoro_VS"
                                                value={newSetId}
                                                onChange={e => setNewSetId(e.target.value)}
                                            />
                                        </div>
                                        <div className="flex-1 min-w-[200px]">
                                            <label className="text-xs font-bold text-slate-500 uppercase">值集名稱 (Set Name)</label>
                                            <input
                                                className="w-full mt-1 px-4 py-3 rounded-xl border border-indigo-200 font-bold outline-none ring-2 ring-transparent focus:ring-indigo-300"
                                                placeholder="e.g. 萬古黴素值集"
                                                value={newSetName}
                                                onChange={e => setNewSetName(e.target.value)}
                                            />
                                        </div>
                                        <div className="flex-1 min-w-[200px]">
                                            <label className="text-xs font-bold text-slate-500 uppercase">Resource (Procedure.code)</label>
                                            <input
                                                className="w-full mt-1 px-4 py-3 rounded-xl border border-indigo-200 font-bold outline-none ring-2 ring-transparent focus:ring-indigo-300"
                                                placeholder="e.g. Procedure.code"
                                                value={newSetResource}
                                                onChange={e => setNewSetResource(e.target.value)}
                                            />
                                        </div>
                                        <button onClick={handleCreateSet} className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700">建立</button>
                                        <button onClick={() => setIsCreatingSet(false)} className="px-6 py-3 bg-white text-slate-500 border border-slate-200 rounded-xl font-bold hover:bg-slate-50">取消</button>
                                    </div>
                                </div>
                            )}

                            {loading ? (
                                <div className="flex justify-center p-20"><Loader2 className="animate-spin text-slate-300" size={40} /></div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {groups.map(group => (
                                        <div
                                            key={group.set_id}
                                            onClick={() => setSelectedSet(group.set_id)}
                                            className="group relative bg-slate-50 hover:bg-white p-6 rounded-3xl border border-slate-200 hover:border-indigo-200 transition-all hover:shadow-xl cursor-pointer"
                                        >
                                            <div className="absolute top-6 right-6 p-2 bg-indigo-100 text-indigo-600 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setEditingGroupId(group.set_id);
                                                        setEditingGroupName(group.set_name || '');
                                                    }}
                                                    className="hover:bg-indigo-200 rounded-full p-1"
                                                >
                                                    <Pencil size={16} />
                                                </button>
                                                <Search size={20} />
                                            </div>
                                            <h3 className="text-lg font-black text-slate-800 mb-1 truncate pr-8">{group.set_id}</h3>

                                            {editingGroupId === group.set_id ? (
                                                <div className="flex items-center gap-2 mb-2" onClick={e => e.stopPropagation()}>
                                                    <input
                                                        autoFocus
                                                        value={editingGroupName}
                                                        onChange={e => setEditingGroupName(e.target.value)}
                                                        className="w-full text-md font-bold text-indigo-600 border-b border-indigo-300 outline-none bg-transparent"
                                                    />
                                                    <button onClick={(e) => handleUpdateGroup(e, group.set_id)} className="text-emerald-500 hover:text-emerald-700"><Check size={18} /></button>
                                                    <button onClick={(e) => { e.stopPropagation(); setEditingGroupId(null); }} className="text-rose-400 hover:text-rose-600"><X size={18} /></button>
                                                </div>
                                            ) : (
                                                <h4 className={`text-md font-bold mb-2 truncate ${!group.set_name ? 'text-slate-300 italic' : 'text-indigo-600'}`}>
                                                    {group.set_name || '未設定名稱'}
                                                </h4>
                                            )}

                                            <p className="text-sm font-bold text-slate-400 mb-4 h-5 truncate">{group.description || '未指定資源'}</p>
                                            <div className="flex items-center gap-2 text-xs font-black text-slate-400 bg-slate-200/50 px-3 py-1.5 rounded-lg w-fit">
                                                <Database size={14} />
                                                {group.total_codes} Codes
                                            </div>
                                        </div>
                                    ))}
                                    {groups.length === 0 && (
                                        <div className="col-span-full py-20 text-center text-slate-400 font-bold">
                                            尚未建立任何值集
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    ) : (
                        // Detail View
                        <div className="flex flex-col h-full">
                            <div className="flex-1 p-0 overflow-hidden flex flex-col">
                                <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                                    <h2 className="font-bold text-slate-500">
                                        代碼清單 ({codes.length})
                                    </h2>
                                    <button
                                        onClick={() => setIsAddingCode(true)}
                                        className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 flex items-center gap-2 text-sm shadow-md"
                                    >
                                        <Plus size={16} />
                                        新增代碼
                                    </button>
                                </div>

                                {isAddingCode && (
                                    <div className="p-6 bg-indigo-50 border-b border-indigo-100 animate-in slide-in-from-top-2">
                                        <div className="grid grid-cols-12 gap-4 items-end">
                                            <div className="col-span-2">
                                                <label className="text-[10px] font-black uppercase text-indigo-400 mb-1 block">標準碼 (Standard)</label>
                                                <input
                                                    autoFocus
                                                    className="w-full px-3 py-2 rounded-lg border border-indigo-200 font-bold text-sm outline-none focus:ring-2 focus:ring-indigo-300"
                                                    placeholder="e.g. 81001C"
                                                    value={newCode.code}
                                                    onChange={e => setNewCode({ ...newCode, code: e.target.value })}
                                                />
                                            </div>
                                            <div className="col-span-3">
                                                <label className="text-[10px] font-black uppercase text-indigo-400 mb-1 block">名稱 (Name)</label>
                                                <input
                                                    className="w-full px-3 py-2 rounded-lg border border-indigo-200 font-bold text-sm outline-none focus:ring-2 focus:ring-indigo-300"
                                                    placeholder="e.g. 剖腹產..."
                                                    value={newCode.display}
                                                    onChange={e => setNewCode({ ...newCode, display: e.target.value })}
                                                />
                                            </div>
                                            <div className="col-span-3">
                                                <label className="text-[10px] font-black uppercase text-indigo-400 mb-1 block">院內碼 (Code)</label>
                                                <input
                                                    className="w-full px-3 py-2 rounded-lg border border-indigo-200 font-bold text-sm outline-none focus:ring-2 focus:ring-indigo-300"
                                                    placeholder="e.g. H_81001"
                                                    value={newCode.hospital_code}
                                                    onChange={e => setNewCode({ ...newCode, hospital_code: e.target.value })}
                                                />
                                            </div>
                                            <div className="col-span-2">
                                                <button onClick={handleAddCode} className="w-full py-2 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 text-sm">儲存</button>
                                            </div>
                                            <div className="col-span-2">
                                                <button onClick={() => setIsAddingCode(false)} className="w-full py-2 bg-white text-slate-400 border border-slate-200 rounded-lg font-bold hover:bg-slate-50 text-sm">取消</button>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <div className="overflow-y-auto flex-1 p-6">
                                    {loadingCodes ? (
                                        <div className="flex justify-center p-10"><Loader2 className="animate-spin text-slate-300" /></div>
                                    ) : (
                                        <table className="w-full text-left border-collapse">
                                            <thead>
                                                <tr className="border-b border-slate-200">
                                                    <th className="py-3 px-4 text-xs font-black text-slate-400 uppercase tracking-widest w-12">#</th>
                                                    <th className="py-3 px-4 text-xs font-black text-slate-400 uppercase tracking-widest w-32">標準碼</th>
                                                    <th className="py-3 px-4 text-xs font-black text-slate-400 uppercase tracking-widest w-32">院內碼 (Code)</th>
                                                    <th className="py-3 px-4 text-xs font-black text-slate-400 uppercase tracking-widest">名稱</th>
                                                    <th className="py-3 px-4 w-20"></th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {codes.map((item, idx) => (
                                                    <tr key={item.id} className="group hover:bg-slate-50 transition-colors">
                                                        <td className="py-3 px-4 font-mono text-xs text-slate-300">{idx + 1}</td>

                                                        {editingCodeId === item.id ? (
                                                            <>
                                                                <td className="py-3 px-4">
                                                                    <input
                                                                        className="w-full px-2 py-1 rounded border border-indigo-200 outline-none font-mono text-indigo-600 font-bold bg-white"
                                                                        value={editingCodeData.code || ''}
                                                                        onChange={e => setEditingCodeData({ ...editingCodeData, code: e.target.value })}
                                                                    />
                                                                </td>
                                                                <td className="py-3 px-4">
                                                                    <input
                                                                        className="w-full px-2 py-1 rounded border border-indigo-200 outline-none font-mono text-emerald-600 font-bold bg-white"
                                                                        value={editingCodeData.hospital_code || ''}
                                                                        onChange={e => setEditingCodeData({ ...editingCodeData, hospital_code: e.target.value })}
                                                                    />
                                                                </td>
                                                                <td className="py-3 px-4">
                                                                    <input
                                                                        className="w-full px-2 py-1 rounded border border-indigo-200 outline-none text-slate-700 font-bold bg-white"
                                                                        value={editingCodeData.display || ''}
                                                                        onChange={e => setEditingCodeData({ ...editingCodeData, display: e.target.value })}
                                                                    />
                                                                </td>
                                                                <td className="py-3 px-4 text-right flex justify-end gap-1">
                                                                    <button onClick={() => handleUpdateCode(item.id)} className="p-2 text-emerald-500 hover:bg-emerald-50 rounded-lg"><Check size={16} /></button>
                                                                    <button onClick={() => setEditingCodeId(null)} className="p-2 text-rose-400 hover:bg-rose-50 rounded-lg"><X size={16} /></button>
                                                                </td>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <td className="py-3 px-4 font-mono font-bold text-indigo-600">{item.code}</td>
                                                                <td className="py-3 px-4 font-mono font-bold text-emerald-600">{item.hospital_code || '-'}</td>
                                                                <td className="py-3 px-4 font-bold text-slate-700">{item.display || '-'}</td>
                                                                <td className="py-3 px-4 text-right">
                                                                    <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                        <button
                                                                            onClick={() => {
                                                                                setEditingCodeId(item.id);
                                                                                setEditingCodeData({ ...item });
                                                                            }}
                                                                            className="p-2 text-slate-300 hover:text-indigo-500 hover:bg-indigo-50 rounded-lg transition-all"
                                                                        >
                                                                            <Pencil size={16} />
                                                                        </button>
                                                                        <button
                                                                            onClick={() => handleRemoveCode(item.id)}
                                                                            className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                                                                        >
                                                                            <Trash2 size={16} />
                                                                        </button>
                                                                    </div>
                                                                </td>
                                                            </>
                                                        )}
                                                    </tr>
                                                ))}
                                                {codes.length === 0 && (
                                                    <tr>
                                                        <td colSpan={5} className="py-10 text-center text-slate-400 text-sm font-bold italic">
                                                            此值集尚無代碼，請點擊上方按鈕新增。
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
