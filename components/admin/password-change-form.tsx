"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { changePassword } from "@/lib/admin-actions";
import { toast } from "sonner";

interface PasswordChangeDialogProps {
    isRequired?: boolean;
    onSuccess?: () => void;
}

export function PasswordChangeForm({ isRequired, onSuccess }: PasswordChangeDialogProps) {
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [loading, setLoading] = useState(false);

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
            onSuccess?.();
        } catch (error: any) {
            toast.error(error.message || "パスワードの変更に失敗しました");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-6 bg-white rounded-lg shadow-lg max-w-md mx-auto">
            <h2 className="text-xl font-bold mb-2">パスワード変更</h2>
            {isRequired && (
                <p className="text-amber-600 text-sm mb-4">
                    初回ログインのため、パスワードを変更してください。
                </p>
            )}
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium mb-1">現在のパスワード</label>
                    <Input
                        type="password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
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
