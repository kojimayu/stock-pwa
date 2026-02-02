"use client";

import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Camera, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface QrScannerProps {
    onScan: (result: string) => void;
    onError?: (error: string) => void;
    isActive: boolean;
}

export function QrScanner({ onScan, onError, isActive }: QrScannerProps) {
    const [isScanning, setIsScanning] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const scannerRef = useRef<Html5Qrcode | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const startScanning = async () => {
        if (!containerRef.current) return;

        try {
            setError(null);
            const scanner = new Html5Qrcode("qr-reader");
            scannerRef.current = scanner;

            await scanner.start(
                { facingMode: "environment" },
                {
                    fps: 10,
                    qrbox: { width: 250, height: 250 },
                },
                (decodedText) => {
                    // 成功時
                    onScan(decodedText);
                    stopScanning();
                },
                () => {
                    // スキャン中のエラーは無視（QRが見つからない場合など）
                }
            );
            setIsScanning(true);
        } catch (err) {
            const message = err instanceof Error ? err.message : "カメラを起動できませんでした";
            setError(message);
            onError?.(message);
        }
    };

    const stopScanning = async () => {
        if (scannerRef.current) {
            try {
                await scannerRef.current.stop();
                scannerRef.current.clear();
            } catch {
                // 停止エラーは無視
            }
            scannerRef.current = null;
        }
        setIsScanning(false);
    };

    useEffect(() => {
        if (isActive && !isScanning) {
            startScanning();
        }
        return () => {
            stopScanning();
        };
    }, [isActive]);

    if (!isActive) return null;

    return (
        <div className="space-y-4">
            {error ? (
                <div className="text-center py-8">
                    <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                    <p className="text-red-600 font-bold">{error}</p>
                    <Button onClick={startScanning} className="mt-4">
                        再試行
                    </Button>
                </div>
            ) : (
                <>
                    <div className="relative">
                        <div
                            id="qr-reader"
                            ref={containerRef}
                            className="w-full aspect-square max-w-sm mx-auto rounded-lg overflow-hidden bg-black"
                        />
                        {/* スキャンライン風のオーバーレイ */}
                        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                            <div className="w-64 h-64 border-2 border-white/50 rounded-lg relative">
                                <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-blue-500 rounded-tl-lg" />
                                <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-blue-500 rounded-tr-lg" />
                                <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-blue-500 rounded-bl-lg" />
                                <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-blue-500 rounded-br-lg" />
                            </div>
                        </div>
                    </div>
                    <p className="text-center text-slate-500 text-sm">
                        <Camera className="inline-block w-4 h-4 mr-1" />
                        QRコードをカメラにかざしてください
                    </p>
                </>
            )}
        </div>
    );
}
