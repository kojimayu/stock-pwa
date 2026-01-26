"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useCartStore } from "@/lib/store";
import { getVendorTransactions } from "@/lib/actions";
import { VendorHistoryList } from "@/components/kiosk/history-list";
import { Button } from "@/components/ui/button";
import { ChevronLeft, Loader2 } from "lucide-react";

// Client Component to handle vendor session and fetching
export default function KioskHistoryPage() {
    const router = useRouter();
    const vendor = useCartStore((state) => state.vendor);
    // Needed to type the state, or use any if we want to avoid double definition without sharing type
    const [transactions, setTransactions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!vendor) {
            router.push("/");
            return;
        }

        getVendorTransactions(vendor.id)
            .then((data) => {
                // Date serialization happens automatically from server actions in newer Next.js but purely safe to keep it as is or handle parsing
                setTransactions(data);
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [vendor, router]);

    if (!vendor) return null;

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col">
            <header className="bg-white border-b border-slate-200 p-4 flex items-center shadow-sm sticky top-0 z-10">
                <Button variant="ghost" className="mr-4" onClick={() => router.back()}>
                    <ChevronLeft className="w-6 h-6 mr-1" />
                    戻る
                </Button>
                <h1 className="text-xl font-bold text-slate-900">利用履歴</h1>
            </header>

            <main className="flex-1 p-4 max-w-2xl mx-auto w-full">
                <div className="mb-4 text-sm text-slate-500 text-center">
                    {vendor.name} 様の直近の履歴
                </div>

                {loading ? (
                    <div className="flex justify-center py-20">
                        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
                    </div>
                ) : (
                    <VendorHistoryList transactions={transactions} />
                )}
            </main>
        </div>
    );
}
