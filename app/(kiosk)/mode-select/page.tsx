"use client";

import { useCartStore } from "@/lib/store";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Package, Truck } from "lucide-react";
import { LogoutButton } from "@/components/kiosk/logout-button";

export default function ModeSelectPage() {
    const router = useRouter();
    const setReturnMode = useCartStore((state) => state.setReturnMode);

    const handleMaterialTakeout = () => {
        setReturnMode(false);
        router.push("/shop");
    };

    const handleAirconTakeout = () => {
        setReturnMode(false);
        router.push("/aircon");
    };

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col">
            <header className="bg-slate-900 text-white p-4 flex justify-between items-center shadow-md">
                <h1 className="text-xl font-bold">作業モード選択</h1>
                <LogoutButton />
            </header>

            <main className="flex-1 flex flex-col md:flex-row gap-8 p-6 items-center justify-center max-w-4xl mx-auto w-full">
                {/* 部材持出し */}
                <div className="w-full md:w-1/2 aspect-square">
                    <Button
                        variant="outline"
                        className="w-full h-full flex flex-col gap-4 text-2xl font-bold bg-white hover:bg-blue-50 border-2 border-slate-200 hover:border-blue-500 hover:text-blue-600 transition-all shadow-sm rounded-3xl"
                        onClick={handleMaterialTakeout}
                    >
                        <Package className="w-24 h-24" />
                        <span>部材持出し</span>
                        <span className="text-sm font-normal text-slate-500">消耗品・部材など</span>
                    </Button>
                </div>

                {/* エアコン持出し */}
                <div className="w-full md:w-1/2 aspect-square">
                    <Button
                        variant="outline"
                        className="w-full h-full flex flex-col gap-4 text-2xl font-bold bg-white hover:bg-emerald-50 border-2 border-slate-200 hover:border-emerald-500 hover:text-emerald-600 transition-all shadow-sm rounded-3xl"
                        onClick={handleAirconTakeout}
                    >
                        <Truck className="w-24 h-24" />
                        <span>エアコン持出し</span>
                        <span className="text-sm font-normal text-slate-500">機器本体 (管理No必須)</span>
                    </Button>
                </div>
            </main>
        </div>
    );
}
