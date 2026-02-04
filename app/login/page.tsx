"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { signIn } from "next-auth/react";
import { useState } from "react";
import { Loader2 } from "lucide-react";

export default function LoginPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const handleCredentialsLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        const result = await signIn("credentials", {
            email,
            password,
            redirect: false,
        });

        if (result?.error) {
            setError("メールアドレスまたはパスワードが正しくありません");
            setLoading(false);
        } else {
            window.location.href = "/admin";
        }
    };

    return (
        <div className="min-h-screen grid place-items-center bg-slate-50">
            <div className="w-full max-w-md p-8 bg-white rounded-xl shadow-lg border border-slate-100">
                <div className="text-center mb-8">
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900">STOCK MGR</h1>
                    <p className="text-sm text-slate-500 mt-2">在庫管理システム 管理者ログイン</p>
                </div>

                {/* メール/パスワードフォーム */}
                <form onSubmit={handleCredentialsLogin} className="space-y-4 mb-6">
                    <div>
                        <Input
                            type="email"
                            placeholder="メールアドレス"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </div>
                    <div>
                        <Input
                            type="password"
                            placeholder="パスワード"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </div>
                    {error && (
                        <p className="text-sm text-red-600">{error}</p>
                    )}
                    <Button type="submit" className="w-full" disabled={loading}>
                        {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        ログイン
                    </Button>
                </form>

                {/* 区切り線 */}
                <div className="relative my-6">
                    <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-slate-200"></div>
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-white px-2 text-slate-400">または</span>
                    </div>
                </div>

                {/* Microsoft SSO */}
                <Button
                    variant="outline"
                    className="w-full flex items-center justify-center gap-3 py-5 border-slate-300"
                    onClick={() => signIn("azure-ad", { callbackUrl: "/admin" })}
                >
                    <svg className="w-5 h-5" viewBox="0 0 23 23" xmlns="http://www.w3.org/2000/svg">
                        <path fill="#f35325" d="M1 1h10v10H1z" />
                        <path fill="#81bc06" d="M12 1h10v10H12z" />
                        <path fill="#05a6f0" d="M1 12h10v10H1z" />
                        <path fill="#ffba08" d="M12 12h10v10H12z" />
                    </svg>
                    Microsoftアカウントでログイン
                </Button>

                <p className="text-xs text-slate-400 mt-6 text-center">
                    ※ Microsoft SSOはHTTPS環境でのみ利用可能です
                </p>
            </div>

            <div className="absolute bottom-4 text-center w-full">
                <a href="/" className="text-sm text-slate-500 hover:text-slate-800 hover:underline">
                    ← Kiosk画面（現場用）へ戻る
                </a>
            </div>
        </div>
    );
}
