"use client";

import { useEffect, useState } from "react";
import { PinPad } from "@/components/kiosk/pin-pad";
import { verifyPin, getVendors, getVendorUsers, createVendorUser } from "@/lib/actions";
import { useRouter } from "next/navigation";
import { useCartStore } from "@/lib/store";
import { toast } from "sonner";
import { Loader2, ChevronLeft, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  const [step, setStep] = useState<"SELECT_VENDOR" | "SELECT_USER" | "ADD_SELF" | "SET_PIN" | "PIN">("SELECT_VENDOR");
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [vendorUsers, setVendorUsers] = useState<VendorUser[]>([]);
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const [selectedUser, setSelectedUser] = useState<VendorUser | null>(null);

  // 自分追加用
  const [newUserName, setNewUserName] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [pinStep, setPinStep] = useState<"ENTER" | "CONFIRM">("ENTER");

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

  const handleAddSelf = () => {
    setStep("ADD_SELF");
    setNewUserName("");
  };

  const handleAddSelfNext = () => {
    if (newUserName.trim()) {
      setStep("SET_PIN");
      setNewPin("");
      setConfirmPin("");
      setPinStep("ENTER");
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
    } else if (step === "ADD_SELF") {
      setStep("SELECT_USER");
      setNewUserName("");
    } else if (step === "SET_PIN") {
      if (pinStep === "CONFIRM") {
        setPinStep("ENTER");
        setConfirmPin("");
      } else {
        setStep("ADD_SELF");
        setNewPin("");
      }
    }
  };

  const handleDigit = (digit: string) => {
    if (step === "PIN" && pin.length < 4) {
      setPin((prev) => prev + digit);
    } else if (step === "SET_PIN") {
      if (pinStep === "ENTER" && newPin.length < 4) {
        setNewPin((prev) => prev + digit);
      } else if (pinStep === "CONFIRM" && confirmPin.length < 4) {
        setConfirmPin((prev) => prev + digit);
      }
    }
  };

  const handleDelete = () => {
    if (step === "PIN") {
      setPin((prev) => prev.slice(0, -1));
    } else if (step === "SET_PIN") {
      if (pinStep === "ENTER") {
        setNewPin((prev) => prev.slice(0, -1));
      } else {
        setConfirmPin((prev) => prev.slice(0, -1));
      }
    }
  };

  const handleClear = () => {
    if (step === "PIN") {
      setPin("");
    } else if (step === "SET_PIN") {
      if (pinStep === "ENTER") {
        setNewPin("");
      } else {
        setConfirmPin("");
      }
    }
  };

  // Auto-submit when 4 digits for login
  useEffect(() => {
    if (pin.length === 4 && selectedVendor && selectedUser) {
      login(selectedVendor.id, selectedUser.id, pin);
    }
  }, [pin, selectedVendor, selectedUser]);

  // PIN設定のフロー
  useEffect(() => {
    if (step === "SET_PIN" && pinStep === "ENTER" && newPin.length === 4) {
      if (newPin === "1234") {
        toast.error("初期PIN(1234)は使用できません");
        setNewPin("");
        return;
      }
      setPinStep("CONFIRM");
    }
  }, [newPin, pinStep, step]);

  useEffect(() => {
    if (step === "SET_PIN" && pinStep === "CONFIRM" && confirmPin.length === 4) {
      if (newPin !== confirmPin) {
        toast.error("PINが一致しません");
        setConfirmPin("");
        return;
      }
      createSelfUser();
    }
  }, [confirmPin, pinStep, step]);

  const createSelfUser = async () => {
    if (!selectedVendor || !newUserName.trim()) return;

    setLoading(true);
    try {
      const res = await createVendorUser(selectedVendor.id, newUserName.trim(), newPin);
      if (res.success && res.vendorUser) {
        toast.success(`${newUserName}さんを登録しました`);
        // 登録完了後、自動ログイン
        setVendorStore(selectedVendor);
        setVendorUserStore({
          id: res.vendorUser.id,
          name: res.vendorUser.name,
          pinChanged: true
        });
        router.push("/mode-select");
        return;
      } else {
        toast.error(res.message || "登録に失敗しました");
        setStep("ADD_SELF");
      }
    } catch (e) {
      toast.error("システムエラーが発生しました");
      setStep("ADD_SELF");
    }
    setLoading(false);
  };

  const login = async (vendorId: number, vendorUserId: number, inputPin: string) => {
    setLoading(true);
    try {
      const res = await verifyPin(vendorId, vendorUserId, inputPin);
      if (res.success && res.vendor && res.vendorUser) {
        setVendorStore(res.vendor);
        setVendorUserStore(res.vendorUser);

        // Wait a tick to ensure store update propagates (just in case)
        await new Promise(resolve => setTimeout(resolve, 100));

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
            <p className="text-xs text-amber-600 font-bold mt-2">
              ※セキュリティのため、操作から10分経過すると自動的にログアウトされます
            </p>
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
            disabled={loading}
            className="flex items-center text-slate-500 hover:text-slate-900 disabled:opacity-50 disabled:cursor-not-allowed"
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

                {/* 自分を追加ボタン */}
                <div className="pt-2 border-t border-slate-100">
                  <Button
                    variant="outline"
                    className="w-full h-14 text-lg"
                    onClick={handleAddSelf}
                  >
                    <UserPlus className="w-5 h-5 mr-2" />
                    自分がいない場合（新規登録）
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Step: Add Self - Name Input */}
      {step === "ADD_SELF" && selectedVendor && (
        <div className="w-full max-w-md space-y-6 bg-white p-8 rounded-2xl shadow-sm border border-slate-100 animate-in fade-in slide-in-from-right-4 duration-300">
          <button
            onClick={handleBack}
            disabled={loading}
            className="flex items-center text-slate-500 hover:text-slate-900 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-5 h-5" />
            戻る
          </button>

          <div className="text-center space-y-2">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 mb-2">
              <UserPlus className="w-8 h-8 text-blue-600" />
            </div>
            <div className="text-lg font-bold text-blue-600">{selectedVendor.name}</div>
            <h1 className="text-2xl font-bold text-slate-900">新規登録</h1>
            <p className="text-slate-500">お名前を入力してください</p>
          </div>

          <div className="space-y-4">
            <Input
              type="text"
              placeholder="例: 田中"
              value={newUserName}
              onChange={(e) => setNewUserName(e.target.value)}
              className="h-20 !text-4xl md:!text-4xl font-bold text-center"
              autoFocus
              disabled={loading}
            />

            <Button
              className="w-full h-14 text-lg font-bold"
              disabled={!newUserName.trim() || loading}
              onClick={handleAddSelfNext}
            >
              次へ（PIN設定）
            </Button>
          </div>
        </div>
      )}

      {/* Step: Set PIN for new user */}
      {step === "SET_PIN" && selectedVendor && (
        <div className="w-full max-w-md space-y-6 bg-white p-8 rounded-2xl shadow-sm border border-slate-100 animate-in fade-in slide-in-from-right-4 duration-300">
          <button
            onClick={handleBack}
            disabled={loading}
            className="flex items-center text-slate-500 hover:text-slate-900 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-5 h-5" />
            戻る
          </button>

          <div className="text-center space-y-2">
            <div className="text-lg font-bold text-blue-600">
              {selectedVendor.name} / {newUserName}
            </div>
            <h1 className="text-2xl font-bold text-slate-900">
              {pinStep === "ENTER" ? "PIN設定" : "PIN確認"}
            </h1>
            <p className="text-slate-500">
              {pinStep === "ENTER"
                ? "4桁のPINコードを設定してください（1234以外）"
                : "もう一度同じPINを入力してください"}
            </p>
          </div>

          <div className="flex justify-center space-x-4 mb-4">
            {[0, 1, 2, 3].map((i) => {
              const currentPin = pinStep === "ENTER" ? newPin : confirmPin;
              return (
                <div
                  key={i}
                  className={`w-6 h-6 rounded-full border-2 transition-colors ${currentPin.length > i
                    ? "bg-blue-600 border-blue-600"
                    : "bg-white border-slate-300"
                    }`}
                />
              );
            })}
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
