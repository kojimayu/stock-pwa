"use client";

import { useEffect, useState } from "react";
import { PinPad } from "@/components/kiosk/pin-pad";
import { verifyPin, getVendors, getVendorUsers } from "@/lib/actions";
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

type Vendor = { id: number; name: string };
type VendorUser = { id: number; name: string; pinChanged: boolean };

// Client Component for Login Logic
export default function KioskLoginPage() {
  const [step, setStep] = useState<"SELECT_VENDOR" | "SELECT_USER" | "PIN">("SELECT_VENDOR");
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [vendorUsers, setVendorUsers] = useState<VendorUser[]>([]);
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const [selectedUser, setSelectedUser] = useState<VendorUser | null>(null);

  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const setVendorStore = useCartStore((state) => state.setVendor);
  const setVendorUserStore = useCartStore((state) => state.setVendorUser);

  // Fetch vendors on mount
  useEffect(() => {
    getVendors().then(setVendors).catch(console.error);
  }, []);

  // Fetch vendor users when vendor selected
  useEffect(() => {
    if (selectedVendor) {
      setLoading(true);
      getVendorUsers(selectedVendor.id)
        .then((users) => {
          setVendorUsers(users);
          setLoading(false);
        })
        .catch((e) => {
          console.error(e);
          setLoading(false);
        });
    }
  }, [selectedVendor]);

  const handleVendorSelect = (vendorId: string) => {
    const vendor = vendors.find(v => v.id.toString() === vendorId);
    if (vendor) {
      setSelectedVendor(vendor);
    }
  };

  const handleVendorNext = () => {
    if (selectedVendor) {
      setStep("SELECT_USER");
      setSelectedUser(null);
    }
  };

  const handleUserSelect = (userId: string) => {
    const user = vendorUsers.find(u => u.id.toString() === userId);
    if (user) {
      setSelectedUser(user);
    }
  };

  const handleUserNext = () => {
    if (selectedUser) {
      setStep("PIN");
      setPin("");
    }
  };

  const handleBack = () => {
    if (step === "SELECT_USER") {
      setStep("SELECT_VENDOR");
      setSelectedVendor(null);
      setSelectedUser(null);
      setVendorUsers([]);
    } else if (step === "PIN") {
      setStep("SELECT_USER");
      setSelectedUser(null);
      setPin("");
    }
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
    if (pin.length === 4 && selectedVendor && selectedUser) {
      login(selectedVendor.id, selectedUser.id, pin);
    }
  }, [pin, selectedVendor, selectedUser]);

  const login = async (vendorId: number, vendorUserId: number, inputPin: string) => {
    setLoading(true);
    try {
      const res = await verifyPin(vendorId, vendorUserId, inputPin);
      if (res.success && res.vendor && res.vendorUser) {
        setVendorStore(res.vendor);
        setVendorUserStore(res.vendorUser);

        // 初期PINの場合はPIN変更画面へ
        if (!res.pinChanged) {
          toast.info("初回ログインのためPINを変更してください");
          router.push("/change-pin");
        } else {
          toast.success(`ログイン: ${res.vendor.name} / ${res.vendorUser.name}`);
          router.push("/mode-select");
        }
        return;
      } else {
        toast.error(res.message || "PINコードが正しくありません");
        setPin("");
      }
    } catch (e) {
      toast.error("システムエラーが発生しました");
      setPin("");
    }
    setLoading(false);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-slate-50">
      {/* Step 1: Select Vendor */}
      {step === "SELECT_VENDOR" && (
        <div className="w-full max-w-md space-y-6 bg-white p-8 rounded-2xl shadow-sm border border-slate-100">
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-bold text-slate-900">業者選択</h1>
            <p className="text-slate-500">会社名を選択してください</p>
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
              onClick={handleVendorNext}
            >
              次へ進む
            </Button>
          </div>
        </div>
      )}

      {/* Step 2: Select User */}
      {step === "SELECT_USER" && selectedVendor && (
        <div className="w-full max-w-md space-y-6 bg-white p-8 rounded-2xl shadow-sm border border-slate-100 animate-in fade-in slide-in-from-right-4 duration-300">
          <button
            onClick={handleBack}
            className="flex items-center text-slate-500 hover:text-slate-900"
          >
            <ChevronLeft className="w-5 h-5" />
            戻る
          </button>

          <div className="text-center space-y-2">
            <div className="text-lg font-bold text-blue-600">{selectedVendor.name}</div>
            <h1 className="text-2xl font-bold text-slate-900">担当者選択</h1>
            <p className="text-slate-500">お名前を選択してください</p>
          </div>

          <div className="space-y-4">
            {loading ? (
              <div className="flex items-center justify-center h-20">
                <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
              </div>
            ) : (
              <>
                <Select onValueChange={handleUserSelect}>
                  <SelectTrigger className="w-full h-16 text-lg">
                    <SelectValue placeholder="担当者を選択..." />
                  </SelectTrigger>
                  <SelectContent>
                    {vendorUsers.map((u) => (
                      <SelectItem key={u.id} value={u.id.toString()} className="text-lg py-3">
                        {u.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Button
                  className="w-full h-14 text-lg font-bold"
                  disabled={!selectedUser}
                  onClick={handleUserNext}
                >
                  次へ進む
                </Button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Step 3: PIN Entry */}
      {step === "PIN" && selectedVendor && selectedUser && (
        <div className="w-full max-w-md space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
          <button
            onClick={handleBack}
            className="absolute top-8 left-8 flex items-center text-slate-500 hover:text-slate-900"
          >
            <ChevronLeft className="w-6 h-6" />
            戻る
          </button>

          <div className="text-center space-y-2">
            <div className="text-lg font-bold text-blue-600">
              {selectedVendor.name} / {selectedUser.name}
            </div>
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
