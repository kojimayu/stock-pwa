'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCartStore } from '@/lib/store';
import { ArrowRight, Loader2, ArrowLeft } from 'lucide-react';
import { verifyPin, verifyVendorPin } from '@/lib/actions';
import { PinPad } from './pin-pad';
import { toast } from 'sonner';

type Vendor = {
    id: number;
    name: string;
};

export default function LoginForm({ vendors }: { vendors: Vendor[] }) {
    const [step, setStep] = useState<'select' | 'pin'>('select');
    const [selectedVendorId, setSelectedVendorId] = useState<string>('');
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleVendorSelect = () => {
        if (!selectedVendorId) {
            toast.error('業者を選択してください');
            return;
        }
        setStep('pin');
    };

    const handlePinComplete = async (pin: string) => {
        setLoading(true);
        try {
            const result = await verifyVendorPin(selectedVendorId, pin);
            if (result.success && result.vendor) {
                toast.success(`ログインしました: ${result.vendor.name}`);

                // ZustandのStateを更新（これが重要）
                useCartStore.getState().setVendor(result.vendor);

                localStorage.setItem('vendorId', result.vendor.id.toString());
                localStorage.setItem('vendorName', result.vendor.name);

                // router.pushが遷移しない場合のフォールバック
                // Next.js App Routerのrouter.pushは非同期だが完了を待てないため、
                // 5秒後にまだ同じページにいる場合はwindow.locationで強制遷移
                const fallbackTimer = setTimeout(() => {
                    console.warn('[Login] router.push did not navigate within 5s, using fallback');
                    window.location.href = '/mode-select';
                }, 5000);

                router.push('/mode-select');

                // 成功時はsetLoading(false)を呼ばない
                // コンポーネントがアンマウントされるため不要
                // fallbackTimerもページ遷移後に自動的にクリアされる
                return;
            } else {
                toast.error(result.message || '認証に失敗しました');
            }
        } catch (e) {
            console.error(e)
            toast.error('エラーが発生しました');
        }
        // 失敗時のみsetLoading(false)を呼ぶ
        setLoading(false);
    };

    const selectedVendorName = vendors.find(v => v.id.toString() === selectedVendorId)?.name;

    if (step === 'select') {
        return (
            <Card className="w-full max-w-md mx-auto shadow-lg">
                <CardHeader>
                    <CardTitle className="text-center text-2xl font-bold">
                        業者選択
                    </CardTitle>
                    <div className="text-center text-gray-500">
                        お名前を選択してください
                    </div>
                </CardHeader>
                <CardContent className="space-y-6">
                    <Select value={selectedVendorId} onValueChange={setSelectedVendorId}>
                        <SelectTrigger className="w-full h-14 text-lg">
                            <SelectValue placeholder="業者を選択..." />
                        </SelectTrigger>
                        <SelectContent>
                            {vendors.map((vendor) => (
                                <SelectItem key={vendor.id} value={vendor.id.toString()} className="text-lg py-3">
                                    {vendor.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </CardContent>
                <CardFooter>
                    <Button
                        className="w-full h-14 text-xl"
                        onClick={handleVendorSelect}
                        disabled={!selectedVendorId}
                    >
                        次へ <ArrowRight className="ml-2" />
                    </Button>
                </CardFooter>
            </Card>
        );
    }

    // PIN Entry Step
    return (
        <div className="w-full max-w-md mx-auto">
            <div className="mb-4 flex items-center justify-between bg-white p-4 rounded-lg shadow-sm">
                <span className="font-bold text-lg">{selectedVendorName} 様</span>
                <Button variant="ghost" size="sm" onClick={() => setStep('select')}>
                    <ArrowLeft className="mr-1 h-4 w-4" /> 戻る
                </Button>
            </div>

            {/* Pass explicit callback to PinPad effectively making it partially controlled looking */}
            <PinPadWrapper onVerify={handlePinComplete} loading={loading} />
        </div>
    );
}

// Wrapper to adapt existing PinPad logic or Replace PinPad logic.
// Simpler to just copy PinPad UI here or modify PinPad to accept onComplete.
// Let's modify PinPad to take props. But first I'll write a wrapper to reuse logic.
import { Delete } from 'lucide-react';

// Simplified PinPad for internal use
function PinPadWrapper({ onVerify, loading }: { onVerify: (pin: string) => Promise<void>, loading: boolean }) {
    const [pin, setPin] = useState('');

    const handlePress = async (num: string) => {
        if (loading) return;
        if (pin.length < 4) {
            const newPin = pin + num;
            setPin(newPin);

            if (newPin.length === 4) {
                // 少し遅延させてPINドット表示を完了させてから認証開始
                await new Promise(resolve => setTimeout(resolve, 200));
                await onVerify(newPin);
                setPin(''); // 失敗時のみここに到達（成功時はページ遷移でアンマウント）
            }
        }
    };

    const handleClear = () => { if (!loading) setPin(''); };
    const handleBackspace = () => { if (!loading) setPin((prev) => prev.slice(0, -1)); };
    const numBtnClass = "h-20 text-3xl font-bold rounded-full";

    return (
        <Card className="shadow-lg">
            <CardHeader>
                <CardTitle className="text-center text-xl">PINコード入力</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="flex justify-center gap-4 mb-8">
                    {[...Array(4)].map((_, i) => (
                        <div key={i} className={`w-4 h-4 rounded-full border border-primary ${i < pin.length ? 'bg-primary' : 'bg-transparent'}`} />
                    ))}
                </div>

                <div className="grid grid-cols-3 gap-4">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                        <Button key={num} variant="outline" className={numBtnClass} onClick={() => handlePress(num.toString())} disabled={loading}>
                            {num}
                        </Button>
                    ))}
                    <Button variant="ghost" className="h-20 text-xl font-medium text-red-500" onClick={handleClear} disabled={loading}>クリア</Button>
                    <Button variant="outline" className={numBtnClass} onClick={() => handlePress('0')} disabled={loading}>0</Button>
                    <Button variant="ghost" className="h-20 justify-center" onClick={handleBackspace} disabled={loading}><Delete className="w-8 h-8" /></Button>
                </div>
                {loading && (
                    <div className="mt-4 flex justify-center items-center text-lg animate-pulse">
                        <Loader2 className="animate-spin mr-2 h-6 w-6" /> 認証中...
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
