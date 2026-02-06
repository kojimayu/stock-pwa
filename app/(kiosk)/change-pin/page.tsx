"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useCartStore } from "@/lib/store";
import { changePin } from "@/lib/actions";
import { toast } from "sonner";
import { PinPad } from "@/components/kiosk/pin-pad";
import { Loader2, KeyRound, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ChangePinPage() {
    const router = useRouter();
    const vendor = useCartStore((state) => state.vendor);
    const vendorUser = useCartStore((state) => state.vendorUser);
    const setVendorUser = useCartStore((state) => state.setVendorUser);

    const [step, setStep] = useState<"ENTER" | "CONFIRM">("ENTER");
    const [newPin, setNewPin] = useState("");
    const [confirmPin, setConfirmPin] = useState("");
    const [loading, setLoading] = useState(false);

    // 未ログインならログイン画面へ
    useEffect(() => {
        if (!vendor || !vendorUser) {
            router.push("/");
        }
    }, [vendor, vendorUser, router]);

    const handleDigit = (digit: string) => {
        if (step === "ENTER" && newPin.length < 4) {
            setNewPin((prev) => prev + digit);
        } else if (step === "CONFIRM" && confirmPin.length < 4) {
            setConfirmPin((prev) => prev + digit);
        }
    };

    const handleDelete = () => {
        if (step === "ENTER") {
            setNewPin((prev) => prev.slice(0, -1));
        } else {
            setConfirmPin((prev) => prev.slice(0, -1));
        }
    };

    const handleClear = () => {
        if (step === "ENTER") {
            setNewPin("");
        } else {
            setConfirmPin("");
        }
    };

    // 4桁入力で次のステップへ
    useEffect(() => {
        if (step === "ENTER" && newPin.length === 4) {
            // 初期PIN(1234)は使用不可
            if (newPin === "1234") {
                toast.error("初期PIN(1234)は使用できません");
                setNewPin("");
                return;
            }
            setStep("CONFIRM");
        }
    }, [newPin, step]);

    // 確認PIN入力完了で保存
    useEffect(() => {
        if (step === "CONFIRM" && confirmPin.length === 4) {
            if (newPin !== confirmPin) {
                toast.error("PINが一致しません");
                setConfirmPin("");
                return;
            }
            submitPin();
        }
    }, [confirmPin, step]);

    const submitPin = async () => {
        if (!vendorUser) return;

        setLoading(true);
        try {
            const res = await changePin(vendorUser.id, newPin);
            if (res.success && res.vendorUser) {
                setVendorUser(res.vendorUser);
                toast.success("PINを変更しました");
                // 強制的にリロードして遷移（ルーターの不具合回避）
                window.location.href = "/mode-select";
            } else {
                toast.error(res.message || "PIN変更に失敗しました");
                setNewPin("");
                setConfirmPin("");
                setStep("ENTER");
                setLoading(false);
            }
        } catch (e) {
            toast.error("システムエラーが発生しました");
            setNewPin("");
            setConfirmPin("");
            setStep("ENTER");
            setLoading(false);
        }
    };

    const handleBack = () => {
        if (step === "CONFIRM") {
            setStep("ENTER");
            setConfirmPin("");
        }
    };

    if (!vendor || !vendorUser) return null;

    return (
        <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-slate-50">
            <div className="w-full max-w-md space-y-6 bg-white p-8 rounded-2xl shadow-sm border border-slate-100">
                {/* Alert */}
                <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                    <AlertCircle className="w-6 h-6 text-amber-600 flex-shrink-0" />
                    <div className="text-sm text-amber-800">
                        <strong>初回ログイン</strong><br />
                        セキュリティのためPINコードを変更してください
                    </div>
                </div>

                {/* Header */}
                <div className="text-center space-y-2">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 mb-2">
                        <KeyRound className="w-8 h-8 text-blue-600" />
                    </div>
                    <div className="text-lg font-bold text-blue-600">
                        {vendor.name} / {vendorUser.name}
                    </div>
                    <h1 className="text-2xl font-bold text-slate-900">
                        {step === "ENTER" ? "新しいPIN入力" : "確認のため再入力"}
                    </h1>
                    <p className="text-slate-500">
                        {step === "ENTER"
                            ? "4桁の数字を入力してください（1234以外）"
                            : "もう一度同じPINを入力してください"}
                    </p>
                </div>

                {/* PIN Dots */}
                <div className="flex justify-center space-x-4 mb-4">
                    {[0, 1, 2, 3].map((i) => {
                        const currentPin = step === "ENTER" ? newPin : confirmPin;
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

                {/* PinPad or Loading */}
                {loading ? (
                    <div className="flex items-center justify-center h-80">
                        <Loader2 className="w-12 h-12 animate-spin text-slate-400" />
                    </div>
                ) : (
                    <>
                        <PinPad
                            onDigitPress={handleDigit}
                            onDeletePress={handleDelete}
                            onClearPress={handleClear}
                        />
                        {step === "CONFIRM" && (
                            <Button
                                variant="outline"
                                className="w-full mt-4"
                                onClick={handleBack}
                            >
                                戻る
                            </Button>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
