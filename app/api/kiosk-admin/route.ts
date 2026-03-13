import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Fully Kiosk REST APIへのプロキシ
// タブレット端末の管理をAdmin画面から行うためのAPI

async function getKioskConfig() {
    const ipConfig = await prisma.systemConfig.findUnique({ where: { key: "kiosk_tablet_ip" } });
    const pwConfig = await prisma.systemConfig.findUnique({ where: { key: "kiosk_tablet_password" } });
    return {
        ip: ipConfig?.value || "",
        password: pwConfig?.value || "",
    };
}

async function fullyRequest(ip: string, password: string, cmd: string, timeout = 5000): Promise<Response> {
    const url = `http://${ip}:2323/?cmd=${cmd}&password=${encodeURIComponent(password)}&type=json`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
        const response = await fetch(url, {
            signal: controller.signal,
            cache: "no-store",
        });
        return response;
    } finally {
        clearTimeout(timeoutId);
    }
}

// GET: デバイス情報取得
export async function GET(request: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const config = await getKioskConfig();
    if (!config.ip || !config.password) {
        return NextResponse.json({
            error: "Kiosk設定が未完了です。設定画面でIPとパスワードを入力してください。",
            needsConfig: true,
        }, { status: 400 });
    }

    try {
        const response = await fullyRequest(config.ip, config.password, "deviceInfo");
        if (!response.ok) {
            return NextResponse.json({
                error: `Fully Kioskからのレスポンスエラー: ${response.status}`,
                online: false,
            }, { status: 502 });
        }

        const data = await response.json();
        return NextResponse.json({
            online: true,
            ip: config.ip,
            battery: data.batteryLevel ?? data.battery ?? null,
            isCharging: data.isPlugged ?? data.plugged ?? null,
            screenOn: data.isScreenOn ?? data.screenOn ?? null,
            currentUrl: data.currentTabUrl ?? data.startUrl ?? null,
            deviceModel: data.deviceModel ?? data.deviceManufacturer ?? null,
            deviceName: data.deviceName ?? null,
            androidVersion: data.androidVersion ?? data.androidSdk ?? null,
            wifiSsid: data.wifiSsid ?? data.ssid ?? null,
            appVersionName: data.appVersionName ?? null,
            ramUsed: data.ramUsedPercentage ?? null,
            storageUsed: data.internalStorageUsedPercentage ?? null,

        });
    } catch (e: any) {
        if (e.name === "AbortError" || e.cause?.code === "ECONNREFUSED" || e.cause?.code === "ETIMEDOUT") {
            return NextResponse.json({
                online: false,
                ip: config.ip,
                error: "タブレットに接続できません。電源やネットワーク接続を確認してください。",
            });
        }
        return NextResponse.json({
            online: false,
            ip: config.ip,
            error: `接続エラー: ${e.message}`,
        });
    }
}

// POST: コマンド実行（reload / screenshot）
export async function POST(request: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const config = await getKioskConfig();
    if (!config.ip || !config.password) {
        return NextResponse.json({
            error: "Kiosk設定が未完了です",
            needsConfig: true,
        }, { status: 400 });
    }

    const body = await request.json();
    const action = body.action as string;

    try {
        switch (action) {
            case "reload": {
                await fullyRequest(config.ip, config.password, "loadStartUrl");
                return NextResponse.json({ success: true, message: "リロードコマンドを送信しました" });
            }

            case "screenshot": {
                const response = await fullyRequest(config.ip, config.password, "getScreenshot", 10000);
                if (!response.ok) {
                    return NextResponse.json({ error: "スクリーンショットの取得に失敗しました" }, { status: 502 });
                }

                const buffer = await response.arrayBuffer();
                const base64 = Buffer.from(buffer).toString("base64");
                const contentType = response.headers.get("content-type") || "image/jpeg";

                return NextResponse.json({
                    success: true,
                    image: `data:${contentType};base64,${base64}`,
                    timestamp: new Date().toISOString(),
                });
            }

            case "camshot": {
                const response = await fullyRequest(config.ip, config.password, "getCamshot", 10000);
                if (!response.ok) {
                    return NextResponse.json({ error: "カメラ撮影に失敗しました" }, { status: 502 });
                }

                const buffer = await response.arrayBuffer();
                const base64 = Buffer.from(buffer).toString("base64");
                const contentType = response.headers.get("content-type") || "image/jpeg";

                return NextResponse.json({
                    success: true,
                    image: `data:${contentType};base64,${base64}`,
                    timestamp: new Date().toISOString(),
                });
            }

            default:
                return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
        }
    } catch (e: any) {
        if (e.name === "AbortError" || e.cause?.code === "ECONNREFUSED") {
            return NextResponse.json({
                error: "タブレットに接続できません",
            }, { status: 502 });
        }
        return NextResponse.json({
            error: `エラー: ${e.message}`,
        }, { status: 500 });
    }
}
