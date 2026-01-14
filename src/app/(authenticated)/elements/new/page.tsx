"use client";

import { FactorForm } from '@/components/elements/FactorForm';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { QualityIndicator } from '@/components/indicator/types';

export default function NewElementPage() {
    const router = useRouter();
    const [indicators, setIndicators] = useState<QualityIndicator[]>([]);

    useEffect(() => {
        // Fetch indicators for reference (if needed by steps)
        const load = async () => {
            // In a real app we might fetch global indicators here
            // For now we pass empty or minimal
        };
        load();
    }, []);

    const handleCancel = () => {
        router.push('/elements');
    };

    return (
        <div className="min-h-screen bg-slate-50/50 p-[3px]">
            <FactorForm onCancel={handleCancel} availableIndicators={indicators} />
        </div>
    );
}
