"use client";

import { useEffect, useState } from "react";
import { PinPad } from "@/components/kiosk/pin-pad";
import { verifyPin, getVendors } from "@/lib/actions";
import { useRouter } from "next/navigation";
import { useCartStore } from "@/lib/store";
import { toast } from "sonner";
import { Loader2, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Client Component for Login Logic
export default function KioskLoginPage() {
  const [step, setStep] = useState<"SELECT" | "PIN">("SELECT");
  const [vendors, setVendors] = useState<{ id: number, name: string }[]>([]);
  const [selectedVendor, setSelectedVendor] = useState<{ id: number, name: string } | null>(null);

  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const setVendorStore = useCartStore((state) => state.setVendor);

  // Fetch vendors on mount
  useEffect(() => {
    getVendors().then(setVendors).catch(console.error);
  }, []);

  const handleVendorSelect = (vendorId: string) => {
    const vendor = vendors.find(v => v.id.toString() === vendorId);
    if (vendor) {
      setSelectedVendor(vendor);
    }
  };

  const handleNext = () => {
    if (selectedVendor) {
      setStep("PIN");
      setPin("");
    }
  };

  const handleBackByPin = () => {
    setStep("SELECT");
    setSelectedVendor(null);
    setPin("");
  };

  const handleDigit = (digit: string) => {
    if (pin.length < 4) {
      setPin((prev) => prev + digit);
    }
  };

  const handleDelete = () => {
    setPin((prev) => prev.slice(0, -1));
  };

  const handleClear = () => {
    setPin("");
  };

  // Auto-submit when 4 digits
  useEffect(() => {
    if (pin.length === 4 && selectedVendor) {
      login(selectedVendor.id, pin);
    }
  }, [pin, selectedVendor]);

  const login = async (vendorId: number, inputPin: string) => {
    setLoading(true);
    try {
      const res = await verifyPin(vendorId, inputPin);
      if (res.success && res.vendor) {
        setVendorStore(res.vendor);
        toast.success(`ログイン: ${res.vendor.name}`);
        router.push("/mode-select");
      } else {
        toast.error(res.message || "PINコードが正しくありません");
        setPin("");
      }
    } catch (e) {
      toast.error("システムエラーが発生しました");
      setPin("");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-slate-50">

      {step === "SELECT" && (
        <div className="w-full max-w-md space-y-6 bg-white p-8 rounded-2xl shadow-sm border border-slate-100">
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-bold text-slate-900">業者選択</h1>
            <p className="text-slate-500">リストから名前を選択してください</p>
          </div>

          <div className="space-y-4">
            <Select onValueChange={handleVendorSelect}>
              <SelectTrigger className="w-full h-16 text-lg">
                <SelectValue placeholder="業者を選択..." />
              </SelectTrigger>
              <SelectContent>
                {vendors.map((v) => (
                  <SelectItem key={v.id} value={v.id.toString()} className="text-lg py-3">
                    {v.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              className="w-full h-14 text-lg font-bold"
              disabled={!selectedVendor}
              onClick={handleNext}
            >
              次へ進む
            </Button>
          </div>
        </div>
      )}

      {step === "PIN" && selectedVendor && (
        <div className="w-full max-w-md space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
          <button
            onClick={handleBackByPin}
            className="absolute top-8 left-8 flex items-center text-slate-500 hover:text-slate-900"
          >
            <ChevronLeft className="w-6 h-6" />
            戻る
          </button>

          <div className="text-center space-y-2">
            <div className="text-lg font-bold text-blue-600">{selectedVendor.name}</div>
            <h1 className="text-2xl font-bold text-slate-900">PIN入力</h1>
            <p className="text-slate-500">4桁のPINコードを入力してください</p>
          </div>

          <div className="flex justify-center space-x-4 mb-4">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className={`w-6 h-6 rounded-full border-2 border-slate-300 ${pin.length > i ? "bg-slate-900 border-slate-900" : "bg-white"
                  }`}
              />
            ))}
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-80">
              <Loader2 className="w-12 h-12 animate-spin text-slate-400" />
            </div>
          ) : (
            <PinPad
              onDigitPress={handleDigit}
              onDeletePress={handleDelete}
              onClearPress={handleClear}
            />
          )}
        </div>
      )}
    </div>
  );
}
