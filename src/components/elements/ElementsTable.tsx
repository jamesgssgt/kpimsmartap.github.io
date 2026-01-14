"use client";

import React, { useState } from 'react';
import { Factor } from '@/components/indicator/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Database, FileEdit, Plus, ArrowRight, Clock } from 'lucide-react';
import Link from 'next/link';

interface Props {
    items: Factor[];
}

export function ElementsTable({ items }: Props) {
    const [searchTerm, setSearchTerm] = useState('');
    const [filterSource, setFilterSource] = useState<'all' | 'FHIR' | 'Manual'>('all');

    const filteredItems = items.filter(item => {
        const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.description.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesSource = filterSource === 'all' ? true : item.sourceType === filterSource;
        return matchesSearch && matchesSource;
    });

    const [activePopover, setActivePopover] = useState<string | null>(null);
    const [viewingIndicator, setViewingIndicator] = useState<any | null>(null); // Use any to avoid complex type import issues if needed, or import QualityIndicator
    const [loadingId, setLoadingId] = useState<string | null>(null);

    const handleViewIndicator = async (id: string, e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setLoadingId(id);

        try {
            const { getIndicatorById } = await import('@/app/actions/fetch-indicators');
            const data = await getIndicatorById(id);
            if (data) {
                setViewingIndicator(data);
                setActivePopover(null); // Close popover
            }
        } catch (error) {
            console.error(error);
            alert("載入指標失敗");
        } finally {
            setLoadingId(null);
        }
    };

    const getMethodLabel = (method: string) => {
        switch (method) {
            case 'sum': return '加總 (Sum)';
            case 'count': return '計數 (Count)';
            case 'distcount': return '不重複計數 (Distinct Count)';
            default: return method;
        }
    };

    return (
        <div className="space-y-6">
            {/* ... search bar ... */}
            <div className="flex flex-col md:flex-row gap-4 justify-between items-end">
                <div className="flex gap-4 items-center w-full md:w-auto">
                    <div className="relative flex-1 md:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <Input
                            placeholder="搜尋要素..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10"
                        />
                    </div>
                    <Link href="/elements/new">
                        <Button className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 rounded-xl whitespace-nowrap">
                            <Plus size={18} /> 新增
                        </Button>
                    </Link>
                </div>
                <div className="flex gap-2">
                    <select
                        className="bg-white border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-100"
                        value={filterSource}
                        onChange={(e) => setFilterSource(e.target.value as any)}
                    >
                        <option value="all">所有來源</option>
                        <option value="FHIR">FHIR (資訊化)</option>
                        <option value="Manual">手動/未定義</option>
                    </select>
                </div>
            </div>

            {/* Click Outside Handler */}
            {activePopover && (
                <div
                    className="fixed inset-0 z-40 bg-transparent"
                    onClick={() => setActivePopover(null)}
                />
            )}

            {/* Indicator Detail Modal */}
            {viewingIndicator && (
                <div className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white w-full max-w-6xl max-h-[90vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
                        {/* Header */}
                        <div className="flex items-center justify-between px-8 py-5 border-b border-slate-100 bg-slate-50/50">
                            <div className="flex items-center gap-3">
                                <div className="bg-indigo-100 p-2 rounded-lg text-indigo-600">
                                    <FileEdit size={20} />
                                </div>
                                <div>
                                    <h3 className="font-black text-slate-800 text-lg">指標詳情</h3>
                                    <p className="text-xs text-slate-400 font-bold">查看与編輯指標定義</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setViewingIndicator(null)}
                                className="w-8 h-8 flex items-center justify-center bg-white border border-slate-200 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors shadow-sm"
                            >
                                <ArrowRight size={16} className="rotate-45" /> {/* X icon alternative */}
                            </button>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-0 bg-slate-50/30">
                            <div className="p-8">
                                {/* Dynamic Import to avoid server/client mismatch during build if needed */}
                                {(() => {
                                    // Hacky internal component render
                                    const { IndicatorForm } = require('@/components/indicator/IndicatorForm');
                                    return (
                                        <IndicatorForm
                                            initialData={viewingIndicator}
                                            availableIndicators={[]} // Pass empty to avoid circular dependency fetching
                                            onCancel={() => setViewingIndicator(null)}
                                            onSave={() => {
                                                setViewingIndicator(null);
                                                // Optional: Trigger refresh
                                                window.location.reload();
                                            }}
                                        />
                                    );
                                })()}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className="bg-white rounded-2xl border shadow-sm">
                <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-slate-500 font-bold border-b">
                        <tr>
                            <th className="px-6 py-4 w-[35%]">名稱 (Name)</th>
                            <th className="px-6 py-4 w-[15%]">計算方式</th>
                            <th className="px-6 py-4 w-[15%]">來源</th>
                            <th className="px-6 py-4 w-[15%]">更新時間</th>
                            <th className="px-6 py-4 w-[10%] text-center">引用數</th>
                            <th className="px-6 py-4 text-right w-[10%]">操作</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {filteredItems.length > 0 ? filteredItems.map((item) => (
                            <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                                <td className="px-6 py-4">
                                    <div className="flex flex-col gap-1">
                                        <span className="font-bold text-slate-800 text-base">{item.name}</span>
                                        <span className="text-xs text-slate-400 line-clamp-1">
                                            {item.description || '無描述'}
                                        </span>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <span className="text-slate-600 font-bold bg-slate-100 px-2 py-1 rounded text-xs whitespace-nowrap">
                                        {getMethodLabel(item.method)}
                                    </span>
                                </td>
                                <td className="px-6 py-4">
                                    {item.sourceType === 'FHIR' ? (
                                        <span className="flex items-center gap-1.5 text-indigo-600 font-bold text-xs bg-indigo-50 px-2 py-1 rounded-md w-fit whitespace-nowrap">
                                            <Database size={12} /> FHIR
                                        </span>
                                    ) : (
                                        <span className="flex items-center gap-1.5 text-slate-400 font-bold text-xs bg-slate-100 px-2 py-1 rounded-md w-fit whitespace-nowrap">
                                            <FileEdit size={12} /> 手動
                                        </span>
                                    )}
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-2 text-slate-400 text-xs whitespace-nowrap">
                                        <Clock size={12} />
                                        {item.updatedAt ? new Date(item.updatedAt).toLocaleDateString() : '-'}
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-center relative">
                                    {item.usageCount ? (
                                        <>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setActivePopover(activePopover === item.id ? null : item.id);
                                                }}
                                                className={`inline-flex items-center justify-center px-3 py-1.5 rounded-full font-bold text-sm transition-all ${activePopover === item.id
                                                    ? 'bg-orange-600 text-white shadow-md scale-110'
                                                    : 'bg-orange-100 text-orange-600 hover:bg-orange-200'
                                                    }`}
                                            >
                                                {item.usageCount}
                                            </button>

                                            {/* Popover */}
                                            {activePopover === item.id && (
                                                <div className="absolute right-1/2 translate-x-1/2 bottom-full mb-3 z-[100] w-96 bg-white text-slate-800 rounded-xl shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-200">
                                                    <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50/50 rounded-t-xl">
                                                        <span className="font-black text-xs text-slate-500 uppercase tracking-wider">引用此要素的指標</span>
                                                        <button onClick={() => setActivePopover(null)} className="text-slate-400 hover:text-slate-600">
                                                            <ArrowRight size={14} className="rotate-45" />
                                                        </button>
                                                    </div>
                                                    <div className="max-h-96 overflow-y-auto p-2">
                                                        {item.usedBy && item.usedBy.length > 0 ? (
                                                            <ul className="space-y-1">
                                                                {item.usedBy.map((u, i) => (
                                                                    <li key={i} className="flex items-center gap-2 px-3 py-2 hover:bg-slate-50 rounded-lg text-left text-sm font-medium text-slate-700 transition-colors">
                                                                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 flex-shrink-0" />

                                                                        <button
                                                                            onClick={(e) => handleViewIndicator(u.id, e)}
                                                                            disabled={loadingId === u.id}
                                                                            className="truncate hover:text-indigo-600 hover:underline flex-1 text-left disabled:opacity-50"
                                                                        >
                                                                            {loadingId === u.id ? '載入中...' : u.name}
                                                                        </button>
                                                                    </li>
                                                                ))}
                                                            </ul>
                                                        ) : (
                                                            <div className="px-4 py-6 text-center text-xs text-slate-400">
                                                                資料同步中...
                                                            </div>
                                                        )}
                                                    </div>
                                                    {/* Arrow */}
                                                    <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px">
                                                        <div className="w-4 h-4 bg-white border-b border-r border-slate-100 transform rotate-45 shadow-sm"></div>
                                                    </div>
                                                </div>
                                            )}
                                        </>
                                    ) : (
                                        <span className="text-slate-300 text-xs font-bold">-</span>
                                    )}
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <Link
                                        href={`/elements/maintain/${item.id}`}
                                        className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors font-bold text-sm shadow-md hover:shadow-lg whitespace-nowrap"
                                    >
                                        <FileEdit size={16} /> 維護
                                    </Link>
                                </td>
                            </tr>
                        )) : (
                            <tr>
                                <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                                    無符合條件的要素
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
