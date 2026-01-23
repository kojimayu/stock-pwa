'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Delete } from 'lucide-react';
import { verifyPin } from '@/lib/actions';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

export default function PinPad() {
    const [pin, setPin] = useState('');
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handlePress = (num: string) => {
        if (pin.length < 4) {
            setPin((prev) => prev + num);
        }
    };

    const handleClear = () => {
        setPin('');
    };

    const handleBackspace = () => {
        setPin((prev) => prev.slice(0, -1));
    };

    useEffect(() => {
        if (pin.length === 4) {
            setLoading(true);
            // 自動送信
            verifyPin(pin)
                .then((result) => {
                    if (result.success && result.vendor) {
                        // ログイン成功
                        // 本来はここでCookieセットなどをServer Action側で行うか、
                        // クライアント側でContextに保存する。
                        // 簡易実装として localStorage に保存して次へ (後でContext化)
                        localStorage.setItem('vendorId', result.vendor.id.toString());
                        localStorage.setItem('vendorName', result.vendor.name);
                        router.push('/shop');
                    } else {
                        // 失敗
                        setPin('');
                        // alert('PINコードが違います'); 
                        // toastがまだ入っていない(sonner推奨)が、ここではalertか、もしinstall済みならtoast
                    }
                })
                .finally(() => {
                    setLoading(false);
                });
        }
    }, [pin, router]);

    const numBtnClass = "h-20 text-3xl font-bold rounded-full";

    return (
        <Card className="w-full max-w-md mx-auto shadow-lg">
            <CardHeader>
                <CardTitle className="text-center text-2xl font-bold">
                    業者ログイン
                </CardTitle>
                <div className="text-center text-gray-500">
                    PINコードを入力してください
                </div>
            </CardHeader>
            <CardContent>
                {/* PIN Display */}
                <div className="flex justify-center gap-4 mb-8">
                    {[...Array(4)].map((_, i) => (
                        <div
                            key={i}
                            className={`w-4 h-4 rounded-full border border-primary ${i < pin.length ? 'bg-primary' : 'bg-transparent'
                                }`}
                        />
                    ))}
                </div>

                {/* Keypad */}
                <div className="grid grid-cols-3 gap-4">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                        <Button
                            key={num}
                            variant="outline"
                            className={numBtnClass}
                            onClick={() => handlePress(num.toString())}
                            disabled={loading}
                        >
                            {num}
                        </Button>
                    ))}
                    <Button
                        variant="ghost"
                        className="h-20 text-xl font-medium text-red-500"
                        onClick={handleClear}
                        disabled={loading}
                    >
                        クリア
                    </Button>
                    <Button
                        variant="outline"
                        className={numBtnClass}
                        onClick={() => handlePress('0')}
                        disabled={loading}
                    >
                        0
                    </Button>
                    <Button
                        variant="ghost"
                        className="h-20 justify-center"
                        onClick={handleBackspace}
                        disabled={loading}
                    >
                        <Delete className="w-8 h-8" />
                    </Button>
                </div>

                {loading && (
                    <div className="mt-4 flex justify-center text-primary animate-pulse">
                        <Loader2 className="animate-spin mr-2" /> 認証中...
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
