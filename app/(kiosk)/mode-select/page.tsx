"use client";

import { useCartStore } from "@/lib/store";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Package, Truck, RotateCcw } from "lucide-react"; // RotateCcw for return icon
import { LogoutButton } from "@/components/kiosk/logout-button";

export default function ModeSelectPage() {
    const router = useRouter();
    const setReturnMode = useCartStore((state) => state.setReturnMode);

    const handleMaterialTakeout = () => {
        setReturnMode(false);
        router.push("/shop");
    };

    const handleMaterialReturn = () => {
        setReturnMode(true);
        router.push("/shop");
    };

    const handleAirconTakeout = () => {
        setReturnMode(false); // Aircon doesn't support return mode yet in this flow
        router.push("/aircon");
    };

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col">
            <header className="bg-slate-900 text-white p-4 flex justify-between items-center shadow-md">
                <h1 className="text-xl font-bold">作業モード選択</h1>
                <LogoutButton />
            </header>

            <main className="flex-1 flex flex-col md:flex-row gap-6 p-6 items-center justify-center max-w-6xl mx-auto w-full">
                {/* Material Takeout */}
                <div className="w-full md:w-1/3 aspect-square">
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

                {/* Material Return */}
                <div className="w-full md:w-1/3 aspect-square">
                    <Button
                        variant="outline"
                        className="w-full h-full flex flex-col gap-4 text-2xl font-bold bg-white hover:bg-orange-50 border-2 border-slate-200 hover:border-orange-500 hover:text-orange-600 transition-all shadow-sm rounded-3xl"
                        onClick={handleMaterialReturn}
                    >
                        <RotateCcw className="w-24 h-24" />
                        <span>部材返却・返品</span>
                        <span className="text-sm font-normal text-slate-500">未使用品の返却など</span>
                    </Button>
                </div>

                {/* Air Conditioner Takeout */}
                <div className="w-full md:w-1/3 aspect-square">
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
