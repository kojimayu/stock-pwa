import { NextRequest, NextResponse } from "next/server";
import { getOrderEmailSettings, markOrderEmailSent } from "@/lib/aircon-actions";
import { prisma } from "@/lib/prisma";

// Graph APIでメール送信するための関数（lib/mail.tsと同じ認証方式）
async function getAccessToken(): Promise<string> {
    const tenantId = process.env.AZURE_TENANT_ID;
    const clientId = process.env.AZURE_CLIENT_ID;
    const clientSecret = process.env.AZURE_CLIENT_SECRET;

    if (!tenantId || !clientId || !clientSecret) {
        throw new Error("Azure AD credentials are missing.");
    }

    const tokenEndpoint = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
    const params = new URLSearchParams();
    params.append("client_id", clientId);
    params.append("scope", "https://graph.microsoft.com/.default");
    params.append("client_secret", clientSecret);
    params.append("grant_type", "client_credentials");

    const response = await fetch(tokenEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params,
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Token取得失敗: ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    return data.access_token;
}

// 発注メール送信API
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { orderId, pdfBase64, orderedBy } = body;

        if (!orderId || !pdfBase64) {
            return NextResponse.json({ error: "orderId と pdfBase64 は必須です" }, { status: 400 });
        }

        // 発注データ取得
        const order = await prisma.airconOrder.findUnique({
            where: { id: orderId },
            include: {
                deliveryLocation: true,
                items: { include: { product: true } }
            }
        });

        if (!order) {
            return NextResponse.json({ error: "発注が見つかりません" }, { status: 404 });
        }

        // メール設定取得
        const settings = await getOrderEmailSettings();
        let toEmail = JSON.parse(settings["aircon_order_to"] || "{}").email;
        let ccEmails = JSON.parse(settings["aircon_order_cc"] || "[]");
        const toConfig = JSON.parse(settings["aircon_order_to"] || "{}");
        const fromCompany = settings["aircon_order_from_company"] || "㈱プラスカンパニー";
        const fromAddress = process.env.SMTP_FROM_ADDRESS;

        // 🔒 テストモード: 開発環境では自動有効 + メール宛先をテスト用アドレスに固定（事故防止）
        const isDevMode = process.env.NODE_ENV === "development";
        const isTestMode = isDevMode || process.env.TEST_MODE === "true";
        const testEmailOverride = process.env.TEST_EMAIL_OVERRIDE;

        if (isTestMode) {
            if (!testEmailOverride) {
                // テストモードでリダイレクト先が未設定 → 送信をブロック
                console.warn(`🚫 テストモード: TEST_EMAIL_OVERRIDE が未設定のためメール送信をブロック (${isDevMode ? "開発環境" : "TEST_MODE=true"})`);
                // 送信記録は残す（UIの整合性のため）
                await markOrderEmailSent(orderId, orderedBy || "テスト送信（ブロック）");
                return NextResponse.json({
                    success: true,
                    orderNumber: order.orderNumber,
                    isTestMode: true,
                    blocked: true,
                    message: "テストモード: TEST_EMAIL_OVERRIDE未設定のためメール送信をスキップしました"
                });
            }
            console.log(`🧪 テストモード: メール宛先を ${testEmailOverride} に固定 (${isDevMode ? "開発環境" : "TEST_MODE=true"})`);
            toEmail = testEmailOverride;
            ccEmails = []; // CCも空にして安全確保
        }

        if (!fromAddress) {
            return NextResponse.json({ error: "SMTP_FROM_ADDRESS が設定されていません" }, { status: 500 });
        }

        // メール件名
        const dateStr = new Date().toLocaleDateString("ja-JP", { year: "numeric", month: "2-digit", day: "2-digit" });
        const locationName = order.deliveryLocation?.name || "本社";
        const testPrefix = isTestMode ? "【テスト】" : "";
        const subject = `${testPrefix}【注文書】${fromCompany} ${locationName} ${dateStr}`;

        // メール本文（HTML）
        const itemRows = order.items.map(item =>
            `<tr>
                <td style="padding: 6px; border: 1px solid #ddd;">${item.product.code}</td>
                <td style="padding: 6px; border: 1px solid #ddd;">${item.product.name}</td>
                <td style="padding: 6px; border: 1px solid #ddd;">${item.product.capacity}</td>
                <td style="padding: 6px; border: 1px solid #ddd; text-align: center;">${item.quantity}</td>
            </tr>`
        ).join("");

        const htmlContent = `
        <div style="font-family: 'メイリオ', sans-serif; max-width: 700px;">
            <p>${toConfig.company || ""}<br>${toConfig.department || ""}<br>${toConfig.name || ""} 様</p>
            <p>お世話になっております。${fromCompany}です。<br>
            下記の通り注文させて頂きますので、ご確認をお願いいたします。</p>
            
            <p><strong>発注番号:</strong> ${order.orderNumber || "-"}<br>
            <strong>納品先:</strong> ${locationName}</p>
            
            <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
                <thead>
                    <tr style="background: #f0f0f0;">
                        <th style="padding: 6px; border: 1px solid #ddd; text-align: left;">品番</th>
                        <th style="padding: 6px; border: 1px solid #ddd; text-align: left;">品名</th>
                        <th style="padding: 6px; border: 1px solid #ddd; text-align: left;">容量</th>
                        <th style="padding: 6px; border: 1px solid #ddd; text-align: center;">数量</th>
                    </tr>
                </thead>
                <tbody>${itemRows}</tbody>
            </table>
            
            ${order.note ? `<p><strong>備考:</strong> ${order.note}</p>` : ""}
            <p style="margin-top: 24px; font-size: 0.9em; color: #666;">
            ※このメールは在庫管理システムから自動送信されています。
            </p>
        </div>`;

        // PDF添付ファイル名
        const pdfFileName = `注文書_${fromCompany}_${locationName}_${dateStr.replace(/\//g, "")}.pdf`;

        // Graph API メール送信
        const accessToken = await getAccessToken();

        const emailMessage = {
            message: {
                subject,
                body: {
                    contentType: "HTML",
                    content: htmlContent,
                },
                toRecipients: [
                    { emailAddress: { address: toEmail } }
                ],
                ccRecipients: ccEmails.map((cc: { email: string }) => ({
                    emailAddress: { address: cc.email }
                })),
                attachments: [
                    {
                        "@odata.type": "#microsoft.graph.fileAttachment",
                        name: pdfFileName,
                        contentType: "application/pdf",
                        contentBytes: pdfBase64,
                    }
                ]
            },
            saveToSentItems: true,
        };

        const sendMailEndpoint = `https://graph.microsoft.com/v1.0/users/${fromAddress}/sendMail`;
        const response = await fetch(sendMailEndpoint, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(emailMessage),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("メール送信エラー:", errorText);
            return NextResponse.json({ error: `メール送信失敗: ${response.statusText}` }, { status: 500 });
        }

        // 送信記録
        await markOrderEmailSent(orderId, orderedBy || fromAddress);

        console.log(`発注メール送信成功: ${order.orderNumber} → ${toEmail}${isTestMode ? " (テストモード)" : ""}`);
        return NextResponse.json({ success: true, orderNumber: order.orderNumber, isTestMode });

    } catch (error) {
        console.error("発注メール送信エラー:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "不明なエラー" },
            { status: 500 }
        );
    }
}
