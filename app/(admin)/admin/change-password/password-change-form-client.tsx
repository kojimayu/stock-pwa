"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { changePassword } from "@/lib/admin-actions";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface PasswordChangeFormClientProps {
    isRequired?: boolean;
}

export function PasswordChangeFormClient({ isRequired }: PasswordChangeFormClientProps) {
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (newPassword !== confirmPassword) {
            toast.error("新しいパスワードが一致しません");
            return;
        }

        if (newPassword.length < 8) {
            toast.error("パスワードは8文字以上必要です");
            return;
        }

        setLoading(true);
        try {
            await changePassword(currentPassword, newPassword);
            toast.success("パスワードを変更しました");
            router.push("/admin");
            router.refresh();
        } catch (error: any) {
            toast.error(error.message || "パスワードの変更に失敗しました");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-8 bg-white rounded-xl shadow-lg max-w-md w-full mx-4">
            <h2 className="text-2xl font-bold mb-2">パスワード変更</h2>
            {isRequired && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-6">
                    <p className="text-amber-700 text-sm">
                        ⚠️ 初回ログインのため、パスワードを変更してください。
                    </p>
                </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium mb-1">現在のパスワード</label>
                    <Input
                        type="password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        placeholder="初期パスワード: plus2025"
                        required
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium mb-1">新しいパスワード</label>
                    <Input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        required
                        minLength={8}
                    />
                    <p className="text-xs text-muted-foreground mt-1">8文字以上</p>
                </div>
                <div>
                    <label className="block text-sm font-medium mb-1">新しいパスワード（確認）</label>
                    <Input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                    />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                    {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    パスワードを変更
                </Button>
            </form>
        </div>
    );
}
