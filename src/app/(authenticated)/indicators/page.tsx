"use client";

import React, { useState, Suspense } from 'react';
import { IndicatorList } from '@/components/indicator/IndicatorList';
import { IndicatorForm } from '@/components/indicator/IndicatorForm';
import { QualityIndicator } from '@/components/indicator/types';
import { AiAssistant } from '@/components/indicator/AiAssistant';
import { useSettings } from '@/contexts/SettingsContext';
import { getIndicators } from '@/app/actions/fetch-indicators';
import { saveIndicator } from '@/app/actions/save-indicator';
import { deleteIndicator } from '@/app/actions/delete-indicator';
import { useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

function IndicatorsContent() {
    const [view, setView] = useState<'list' | 'create' | 'edit'>('list');
    const [editingIndicator, setEditingIndicator] = useState<QualityIndicator | null>(null);
    const [indicators, setIndicators] = useState<QualityIndicator[]>([]);
    const [focusSection, setFocusSection] = useState<'num' | 'den' | null>(null);

    const searchParams = useSearchParams();
    const router = useRouter();
    const editId = searchParams.get('edit');
    const sectionParam = searchParams.get('section');
    const createParam = searchParams.get('create');

    const { enableAi } = useSettings();

    useEffect(() => {
        const loadIndicators = async () => {
            const data = await getIndicators();
            setIndicators(data);

            // Handle Deep Linking
            if (editId) {
                const target = data.find(i => i.id === editId);
                if (target) {
                    setEditingIndicator(target);
                    setView('edit');
                    if (sectionParam === 'num' || sectionParam === 'den') {
                        setFocusSection(sectionParam);
                    } else {
                        setFocusSection(null);
                    }
                }
            } else if (createParam) {
                setEditingIndicator(null);
                setView('create');
                if (sectionParam === 'num' || sectionParam === 'den') {
                    setFocusSection(sectionParam);
                }
            }
        };
        loadIndicators();
    }, [editId, sectionParam, createParam]); // Dependency on params to re-trigger if URL changes

    const handleSave = (indicator: QualityIndicator) => {
        if (view === 'create') {
            setIndicators([...indicators, indicator]);
        } else {
            setIndicators(indicators.map(i => i.id === indicator.id ? indicator : i));
        }

        // If in focus mode, redirect back to elements page
        if (focusSection) {
            router.push('/elements');
        } else {
            setView('list');
            setEditingIndicator(null);
            router.push('/indicators'); // Clear params
        }
    };

    const handleCancel = () => {
        if (focusSection) {
            router.push('/elements');
        } else {
            setView('list');
            setEditingIndicator(null);
            router.push('/indicators'); // Clear params
        }
    };

    const handleDelete = async (id: string) => {
        if (confirm('確定要刪除此指標嗎？')) {
            const result = await deleteIndicator(id);
            if (result.success) {
                setIndicators(indicators.filter(i => i.id !== id));
            } else {
                alert("刪除失敗: " + result.message);
            }
        }
    };

    const handleClone = async (indicator: QualityIndicator) => {
        const cloned: QualityIndicator = {
            ...indicator,
            id: Math.random().toString(36).substr(2, 9),
            name: `${indicator.name} (複製副本)`
        };

        try {
            const result = await saveIndicator(cloned);
            if (result.success && result.kpiid) {
                setIndicators([...indicators, { ...cloned, id: result.kpiid }]);
            } else {
                alert("複製失敗: " + result.message);
            }
        } catch (e) {
            alert("複製發生錯誤");
            console.error(e);
        }
    };

    const handlePin = async (id: string, isPinned: boolean) => {
        setIndicators(indicators.map(i => i.id === id ? { ...i, isPinned } : i));
        const { togglePinIndicator } = await import('@/app/actions/toggle-pin');
        const res = await togglePinIndicator(id, isPinned);
        if (!res.success) {
            alert("釘選狀態更新失敗: " + res.message);
            setIndicators(indicators.map(i => i.id === id ? { ...i, isPinned: !isPinned } : i));
        }
    };

    return (
        <div className="min-h-screen bg-slate-50/50 p-[2px] pb-32">
            {!focusSection && view === 'list' && (
                <IndicatorList
                    indicators={indicators}
                    onCreate={() => { setEditingIndicator(null); setView('create'); setFocusSection(null); router.push('/indicators'); }}
                    onEdit={(ind) => { setEditingIndicator(ind); setView('edit'); setFocusSection(null); router.push('/indicators'); }}
                    onDelete={handleDelete}
                    onClone={handleClone}
                    onPin={handlePin}
                />
            )}

            {(view === 'create' || view === 'edit') && (
                <div className="w-full max-w-[1920px] mx-auto animate-in slide-in-from-bottom-8 duration-500">
                    {!focusSection && (
                        <div className="mb-8 flex items-center gap-2 text-sm font-bold text-slate-400">
                            <button onClick={handleCancel} className="hover:text-indigo-600 transition-colors">指標列表</button>
                            <span>/</span>
                            <span className="text-slate-700">{view === 'create' ? '新增指標' : '編輯指標'}</span>
                        </div>
                    )}
                    <IndicatorForm
                        initialData={editingIndicator}
                        availableIndicators={indicators.filter(i => i.id !== editingIndicator?.id)}
                        onSave={handleSave}
                        onCancel={handleCancel}
                        focusSection={focusSection}
                    />
                </div>
            )}

            {enableAi && <AiAssistant />}
        </div>
    );
}

export default function IndicatorsPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <IndicatorsContent />
        </Suspense>
    );
}
