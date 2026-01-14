"use client";

import React, { useEffect, useState } from 'react';
import { FactorForm } from '@/components/elements/FactorForm';
import { useRouter } from 'next/navigation';
import { Factor, QualityIndicator } from '@/components/indicator/types';
import { getFactorById, deleteFactor } from '@/app/actions/kift';
import { Loader2 } from 'lucide-react';

interface Props {
    params: Promise<{
        id: string;
    }>;
}

export default function MaintainElementPage({ params }: Props) {
    const { id } = React.use(params);
    const router = useRouter();
    const [factor, setFactor] = useState<Factor | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            try {
                const data = await getFactorById(id);
                setFactor(data);
            } catch (error) {
                console.error('Failed to load factor:', error);
                alert('無法載入要素資料');
                router.push('/elements');
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [id, router]);

    const handleCancel = () => {
        router.push('/elements');
    };

    const handleDelete = async () => {
        if (!confirm('確定要刪除此要素嗎？此動作無法復原。')) return;

        try {
            await deleteFactor(id);
            alert('要素已刪除');
            router.push('/elements');
        } catch (error: any) {
            console.error('Failed to delete factor:', error);
            alert(`刪除失敗: ${error.message}`);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <Loader2 className="animate-spin text-indigo-600" size={48} />
            </div>
        );
    }

    if (!factor) return null;

    return (
        <div className="min-h-screen bg-slate-50/50 p-[3px]">
            <FactorForm initialData={factor} onCancel={handleCancel} onDelete={handleDelete} availableIndicators={[]} />
        </div>
    );
}
