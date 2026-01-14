"use client";

import { useEffect, useState } from "react";
import { getFactors } from "@/app/actions/kift";
import { Factor } from "@/components/indicator/types";
import { ElementsTable } from "@/components/elements/ElementsTable";
import { Loader2 } from "lucide-react";

export default function ElementsPage() {
    const [items, setItems] = useState<Factor[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            try {
                const data = await getFactors();
                setItems(data);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    return (
        <div className="min-h-screen bg-slate-50/50 p-6 md:p-12 pb-32">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight">要素管理 (Factors)</h1>

                </div>
            </div>

            {loading ? (
                <div className="flex justify-center py-20">
                    <Loader2 className="animate-spin text-indigo-600" size={32} />
                </div>
            ) : (
                <ElementsTable items={items} />
            )}
        </div>
    );
}
