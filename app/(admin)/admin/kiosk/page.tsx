"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
    Wifi, WifiOff, Battery, BatteryCharging, BatteryFull, BatteryLow, BatteryMedium, BatteryWarning,
    RefreshCw, Camera, Monitor, MonitorOff, Loader2, AlertCircle, Settings, Smartphone
} from "lucide-react";

type DeviceInfo = {
    online: boolean;
    ip?: string;
    battery?: number;
    isCharging?: boolean;
    screenOn?: boolean;
    currentUrl?: string;
    deviceModel?: string;
    deviceName?: string;
    androidVersion?: string;
    wifiSsid?: string;
    appVersionName?: string;
    ramUsed?: number;
    storageUsed?: number;
    error?: string;
    needsConfig?: boolean;
};

function BatteryIcon({ level, isCharging }: { level: number; isCharging: boolean }) {
    if (isCharging) return <BatteryCharging className="w-5 h-5 text-green-500" />;
    if (level >= 80) return <BatteryFull className="w-5 h-5 text-green-500" />;
    if (level >= 50) return <BatteryMedium className="w-5 h-5 text-yellow-500" />;
    if (level >= 20) return <BatteryLow className="w-5 h-5 text-orange-500" />;
    return <BatteryWarning className="w-5 h-5 text-red-500" />;
}

export default function KioskAdminPage() {
    const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | null>(null);
    const [loading, setLoading] = useState(true);
    const [reloading, setReloading] = useState(false);
    const [capturing, setCapturing] = useState(false);
    const [camCapturing, setCamCapturing] = useState(false);
    const [screenshot, setScreenshot] = useState<string | null>(null);
    const [screenshotTime, setScreenshotTime] = useState<string | null>(null);
    const [camshot, setCamshot] = useState<string | null>(null);
    const [camshotTime, setCamshotTime] = useState<string | null>(null);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);

    const fetchDeviceInfo = useCallback(async () => {
        try {
            const res = await fetch("/api/kiosk-admin", { cache: "no-store" });
            const data = await res.json();
            setDeviceInfo(data);
            setLastUpdated(new Date());
        } catch {
            setDeviceInfo({ online: false, error: "サーバーへの接続に失敗しました" });
        } finally {
            setLoading(false);
        }
    }, []);

    // 初回取得 + 30秒ごとの自動リフレッシュ
    useEffect(() => {
        fetchDeviceInfo();
        intervalRef.current = setInterval(fetchDeviceInfo, 30000);
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [fetchDeviceInfo]);

    const handleReload = async () => {
        setReloading(true);
        try {
            const res = await fetch("/api/kiosk-admin", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "reload" }),
            });
            const data = await res.json();
            if (data.success) {
                toast.success("リロードコマンドを送信しました");
                setTimeout(fetchDeviceInfo, 3000);
            } else {
                toast.error(data.error || "リロードに失敗しました");
            }
        } catch {
            toast.error("リロードに失敗しました");
        }
        setReloading(false);
    };

    const handleScreenshot = async () => {
        setCapturing(true);
        try {
            const res = await fetch("/api/kiosk-admin", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "screenshot" }),
            });
            const data = await res.json();
            if (data.success && data.image) {
                setScreenshot(data.image);
                setScreenshotTime(new Date().toLocaleTimeString("ja-JP"));
                toast.success("スクリーンショットを取得しました");
            } else {
                toast.error(data.error || "スクリーンショットの取得に失敗しました");
            }
        } catch {
            toast.error("スクリーンショットの取得に失敗しました");
        }
        setCapturing(false);
    };

    const handleCamshot = async () => {
        setCamCapturing(true);
        try {
            const res = await fetch("/api/kiosk-admin", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "camshot" }),
            });
            const data = await res.json();
            if (data.success && data.image) {
                setCamshot(data.image);
                setCamshotTime(new Date().toLocaleTimeString("ja-JP"));
                toast.success("カメラ撮影しました");
            } else {
                toast.error(data.error || "カメラ撮影に失敗しました");
            }
        } catch {
            toast.error("カメラ撮影に失敗しました");
        }
        setCamCapturing(false);
    };

    // 設定未完了の場合
    if (!loading && deviceInfo?.needsConfig) {
        return (
            <div className="space-y-6">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Kiosk管理</h2>
                    <p className="text-muted-foreground">タブレット端末のリモート管理</p>
                </div>
                <div className="border rounded-lg p-8 bg-white text-center space-y-4">
                    <Settings className="w-16 h-16 text-slate-300 mx-auto" />
                    <h3 className="text-xl font-bold text-slate-700">初期設定が必要です</h3>
                    <p className="text-slate-500 max-w-md mx-auto">
                        Kiosk管理を使用するには、設定画面でタブレットのIPアドレスとFully Kiosk Remote Adminパスワードを入力してください。
                    </p>
                    <Button
                        onClick={() => window.location.href = "/admin/settings"}
                        className="mt-2"
                    >
                        <Settings className="w-4 h-4 mr-2" />
                        設定画面へ
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* ヘッダー */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Kiosk管理</h2>
                    <p className="text-muted-foreground">タブレット端末のリモート管理</p>
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => { setLoading(true); fetchDeviceInfo(); }}
                    disabled={loading}
                >
                    <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />
                    更新
                </Button>
            </div>

            {/* ステータスカード */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* 接続状態 */}
                <div className="border rounded-lg p-5 bg-white">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-medium text-slate-500">接続状態</span>
                        {loading ? (
                            <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
                        ) : deviceInfo?.online ? (
                            <Wifi className="w-5 h-5 text-green-500" />
                        ) : (
                            <WifiOff className="w-5 h-5 text-red-500" />
                        )}
                    </div>
                    <div className="text-2xl font-bold">
                        {loading ? (
                            <span className="text-slate-400">確認中...</span>
                        ) : deviceInfo?.online ? (
                            <span className="text-green-600">オンライン</span>
                        ) : (
                            <span className="text-red-600">オフライン</span>
                        )}
                    </div>
                    {deviceInfo?.ip && (
                        <p className="text-xs text-slate-400 mt-1">{deviceInfo.ip}</p>
                    )}
                </div>

                {/* バッテリー */}
                <div className="border rounded-lg p-5 bg-white">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-medium text-slate-500">バッテリー</span>
                        {deviceInfo?.online && deviceInfo.battery != null ? (
                            <BatteryIcon level={deviceInfo.battery} isCharging={deviceInfo.isCharging ?? false} />
                        ) : (
                            <Battery className="w-5 h-5 text-slate-300" />
                        )}
                    </div>
                    <div className="text-2xl font-bold">
                        {deviceInfo?.online && deviceInfo.battery != null ? (
                            <span>{deviceInfo.battery}%</span>
                        ) : (
                            <span className="text-slate-400">--</span>
                        )}
                    </div>
                    {deviceInfo?.isCharging && (
                        <p className="text-xs text-green-600 mt-1">充電中</p>
                    )}
                </div>

                {/* 画面状態 */}
                <div className="border rounded-lg p-5 bg-white">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-medium text-slate-500">画面</span>
                        {deviceInfo?.online ? (
                            deviceInfo.screenOn ? (
                                <Monitor className="w-5 h-5 text-blue-500" />
                            ) : (
                                <MonitorOff className="w-5 h-5 text-slate-400" />
                            )
                        ) : (
                            <Monitor className="w-5 h-5 text-slate-300" />
                        )}
                    </div>
                    <div className="text-2xl font-bold">
                        {deviceInfo?.online ? (
                            deviceInfo.screenOn ? (
                                <span className="text-blue-600">ON</span>
                            ) : (
                                <span className="text-slate-500">OFF</span>
                            )
                        ) : (
                            <span className="text-slate-400">--</span>
                        )}
                    </div>
                </div>

                {/* デバイス */}
                <div className="border rounded-lg p-5 bg-white">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-medium text-slate-500">デバイス</span>
                        <Smartphone className="w-5 h-5 text-slate-400" />
                    </div>
                    <div className="text-sm font-bold truncate">
                        {deviceInfo?.online && deviceInfo.deviceModel ? (
                            <span>{deviceInfo.deviceModel}</span>
                        ) : (
                            <span className="text-slate-400">--</span>
                        )}
                    </div>
                    {deviceInfo?.online && (
                        <div className="text-xs text-slate-400 mt-1 space-y-0.5">
                            {deviceInfo.androidVersion && <div>Android {deviceInfo.androidVersion}</div>}
                            {deviceInfo.wifiSsid && <div>WiFi: {deviceInfo.wifiSsid}</div>}
                        </div>
                    )}
                </div>
            </div>

            {/* エラー表示 */}
            {!loading && !deviceInfo?.online && deviceInfo?.error && (
                <div className="flex items-start gap-3 border border-red-200 bg-red-50 rounded-lg p-4">
                    <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                    <div>
                        <p className="text-sm font-medium text-red-800">{deviceInfo.error}</p>
                        <p className="text-xs text-red-600 mt-1">
                            タブレットの電源が入っていること、同じネットワーク上にあること、Fully Kiosk BrowserのRemote Adminが有効であることを確認してください。
                        </p>
                    </div>
                </div>
            )}

            {/* アクションボタン */}
            <div className="border rounded-lg p-6 bg-white space-y-4">
                <h3 className="text-lg font-bold flex items-center gap-2">
                    <RefreshCw className="w-5 h-5 text-blue-600" />
                    リモート操作
                </h3>
                <div className="flex flex-wrap gap-3">
                    <Button
                        onClick={handleReload}
                        disabled={reloading || !deviceInfo?.online}
                        variant="outline"
                        className="h-12 px-6"
                    >
                        {reloading ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                            <RefreshCw className="w-4 h-4 mr-2" />
                        )}
                        ページリロード
                    </Button>
                    <Button
                        onClick={handleScreenshot}
                        disabled={capturing || !deviceInfo?.online}
                        variant="outline"
                        className="h-12 px-6"
                    >
                        {capturing ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                            <Camera className="w-4 h-4 mr-2" />
                        )}
                        スクリーンショット
                    </Button>
                    <Button
                        onClick={handleCamshot}
                        disabled={camCapturing || !deviceInfo?.online}
                        variant="outline"
                        className="h-12 px-6"
                    >
                        {camCapturing ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                            <Camera className="w-4 h-4 mr-2" />
                        )}
                        📷 カメラ撮影
                    </Button>
                </div>
                {!deviceInfo?.online && (
                    <p className="text-xs text-slate-400">※ タブレットがオフラインの場合、リモート操作は使用できません</p>
                )}
            </div>

            {/* スクリーンショット表示 */}
            {screenshot && (
                <div className="border rounded-lg p-6 bg-white space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-bold flex items-center gap-2">
                            <Camera className="w-5 h-5 text-blue-600" />
                            スクリーンショット
                        </h3>
                        <span className="text-xs text-slate-400">{screenshotTime}</span>
                    </div>
                    <div className="border rounded-lg overflow-hidden bg-slate-100">
                        <img
                            src={screenshot}
                            alt="タブレット画面"
                            className="w-full max-w-2xl mx-auto"
                        />
                    </div>
                </div>
            )}

            {/* カメラ撮影表示 */}
            {camshot && (
                <div className="border rounded-lg p-6 bg-white space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-bold flex items-center gap-2">
                            📷 カメラ撮影
                        </h3>
                        <span className="text-xs text-slate-400">{camshotTime}</span>
                    </div>
                    <div className="border rounded-lg overflow-hidden bg-slate-100">
                        <img
                            src={camshot}
                            alt="カメラ撮影"
                            className="w-full max-w-2xl mx-auto"
                        />
                    </div>
                </div>
            )}

            {/* 最終更新 */}
            {lastUpdated && (
                <p className="text-xs text-slate-400 text-right">
                    最終取得: {lastUpdated.toLocaleTimeString("ja-JP")}（30秒ごとに自動更新）
                </p>
            )}
        </div>
    );
}
