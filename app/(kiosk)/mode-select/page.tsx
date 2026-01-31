import { Button } from "@/components/ui/button";
import { Package, Truck } from "lucide-react";
import Link from "next/link";
import { LogoutButton } from "@/components/kiosk/logout-button"; // Assuming I need to create or use existing logout logic

export default function ModeSelectPage() {
    return (
        <div className="min-h-screen bg-slate-50 flex flex-col">
            <header className="bg-slate-900 text-white p-4 flex justify-between items-center shadow-md">
                <h1 className="text-xl font-bold">作業モード選択</h1>
                <LogoutButton />
            </header>

            <main className="flex-1 flex flex-col md:flex-row gap-6 p-6 items-center justify-center">
                {/* Material Takeout */}
                <Link href="/shop" className="w-full md:w-1/2 max-w-sm aspect-square">
                    <Button
                        variant="outline"
                        className="w-full h-full flex flex-col gap-4 text-2xl font-bold bg-white hover:bg-blue-50 border-2 border-slate-200 hover:border-blue-500 hover:text-blue-600 transition-all shadow-sm rounded-3xl"
                    >
                        <Package className="w-24 h-24" />
                        <span>材料持出し</span>
                        <span className="text-sm font-normal text-slate-500">消耗品・部材など</span>
                    </Button>
                </Link>

                {/* Air Conditioner Takeout */}
                <Link href="/aircon" className="w-full md:w-1/2 max-w-sm aspect-square">
                    <Button
                        variant="outline"
                        className="w-full h-full flex flex-col gap-4 text-2xl font-bold bg-white hover:bg-emerald-50 border-2 border-slate-200 hover:border-emerald-500 hover:text-emerald-600 transition-all shadow-sm rounded-3xl"
                    >
                        <Truck className="w-24 h-24" />
                        <span>エアコン持出し</span>
                        <span className="text-sm font-normal text-slate-500">機器本体 (管理No必須)</span>
                    </Button>
                </Link>
            </main>
        </div>
    );
}
