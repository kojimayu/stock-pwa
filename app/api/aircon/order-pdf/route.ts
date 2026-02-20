import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getOrderEmailSettings } from "@/lib/aircon-actions";
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const pdfkit = require("pdfkit") as any;
const PDFDocument = pdfkit.default || pdfkit;
import path from "path";
import fs from "fs";

// 日本語フォントパスを事前解決
const FONT_PATH = path.join(process.cwd(), "fonts", "NotoSansJP-Regular.ttf");

// 注文書PDF生成API（サーバーサイド・日本語対応）
export async function POST(request: NextRequest) {
    try {
        // フォントファイル存在チェック
        if (!fs.existsSync(FONT_PATH)) {
            console.error(`フォントが見つかりません: ${FONT_PATH}`);
            return NextResponse.json({ error: "日本語フォントが見つかりません" }, { status: 500 });
        }

        const body = await request.json();
        const { orderId } = body;

        if (!orderId) {
            return NextResponse.json({ error: "orderId は必須です" }, { status: 400 });
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

        // メール設定から会社情報取得
        const settings = await getOrderEmailSettings();
        const rawFromCompany = settings["aircon_order_from_company"] || "株式会社プラスカンパニー";
        // ㈱→株式会社に正規化（フォント未対応文字を回避）
        const fromCompany = normalizeText(rawFromCompany);
        const toConfig = JSON.parse(settings["aircon_order_to"] || "{}");

        // 納品先名の決定
        const deliveryName = order.deliveryLocation?.name
            || (order as Record<string, unknown>).customDeliveryName as string
            || "本社";

        // PDF生成
        const pdfBuffer = await generateOrderPDF({
            orderNumber: (order as Record<string, unknown>).orderNumber as string || "",
            date: (order as Record<string, unknown>).orderedAt
                ? new Date((order as Record<string, unknown>).orderedAt as string)
                : new Date(),
            toCompany: normalizeText(toConfig.company || "日立グローバルライフソリューションズ株式会社"),
            fromCompany,
            deliveryName,
            items: (order.items as Array<{
                product: { code: string; name: string; capacity: string; suffix: string; orderPrice: number };
                quantity: number;
            }>).map(item => ({
                name: `エアコン　${item.product.code}${item.product.suffix}`,
                quantity: item.quantity,
                unit: "セット",
                unitPrice: item.product.orderPrice || 0,
                amount: item.quantity * (item.product.orderPrice || 0),
            })),
            note: order.note || "",
        });

        // Base64で返却（メール添付用）
        const pdfBase64 = pdfBuffer.toString("base64");

        return NextResponse.json({
            success: true,
            pdfBase64,
            fileName: `注文書_${fromCompany}_${deliveryName}_${formatDate(new Date()).replace(/\//g, "")}.pdf`,
        });

    } catch (error) {
        console.error("PDF生成エラー:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "不明なエラー" },
            { status: 500 }
        );
    }
}

// 日付フォーマット
function formatDate(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}/${m}/${d}`;
}

// 金額フォーマット
function formatPrice(amount: number): string {
    return amount.toLocaleString("ja-JP");
}

// 文字正規化（フォント未対応文字を置換）
function normalizeText(text: string): string {
    // ㈱ → 株式会社
    let result = text.replace(/㈱/g, "株式会社");
    // ㈲ → 有限会社
    result = result.replace(/㈲/g, "有限会社");
    // 半角カタカナ → 全角カタカナ
    const halfToFull: Record<string, string> = {
        'ｱ': 'ア', 'ｲ': 'イ', 'ｳ': 'ウ', 'ｴ': 'エ', 'ｵ': 'オ', 'ｶ': 'カ', 'ｷ': 'キ', 'ｸ': 'ク', 'ｹ': 'ケ', 'ｺ': 'コ',
        'ｻ': 'サ', 'ｼ': 'シ', 'ｽ': 'ス', 'ｾ': 'セ', 'ｿ': 'ソ', 'ﾀ': 'タ', 'ﾁ': 'チ', 'ﾂ': 'ツ', 'ﾃ': 'テ', 'ﾄ': 'ト',
        'ﾅ': 'ナ', 'ﾆ': 'ニ', 'ﾇ': 'ヌ', 'ﾈ': 'ネ', 'ﾉ': 'ノ', 'ﾊ': 'ハ', 'ﾋ': 'ヒ', 'ﾌ': 'フ', 'ﾍ': 'ヘ', 'ﾎ': 'ホ',
        'ﾏ': 'マ', 'ﾐ': 'ミ', 'ﾑ': 'ム', 'ﾒ': 'メ', 'ﾓ': 'モ', 'ﾔ': 'ヤ', 'ﾕ': 'ユ', 'ﾖ': 'ヨ',
        'ﾗ': 'ラ', 'ﾘ': 'リ', 'ﾙ': 'ル', 'ﾚ': 'レ', 'ﾛ': 'ロ', 'ﾜ': 'ワ', 'ｦ': 'ヲ', 'ﾝ': 'ン',
        'ﾞ': '゛', 'ﾟ': '゜', 'ｰ': 'ー', '｡': '。', '｢': '「', '｣': '」', '､': '、',
    };
    result = result.replace(/[ｦ-ﾟ]/g, (ch) => halfToFull[ch] || ch);
    // 濁点・半濁点の結合（ｸﾞ → グ 等）
    result = result.replace(/(.)゛/g, (_, ch) => {
        const dakuten: Record<string, string> = {
            'カ': 'ガ', 'キ': 'ギ', 'ク': 'グ', 'ケ': 'ゲ', 'コ': 'ゴ',
            'サ': 'ザ', 'シ': 'ジ', 'ス': 'ズ', 'セ': 'ゼ', 'ソ': 'ゾ',
            'タ': 'ダ', 'チ': 'ヂ', 'ツ': 'ヅ', 'テ': 'デ', 'ト': 'ド',
            'ハ': 'バ', 'ヒ': 'ビ', 'フ': 'ブ', 'ヘ': 'ベ', 'ホ': 'ボ',
            'ウ': 'ヴ',
        };
        return dakuten[ch] || ch + '゛';
    });
    result = result.replace(/(.)゜/g, (_, ch) => {
        const handakuten: Record<string, string> = {
            'ハ': 'パ', 'ヒ': 'ピ', 'フ': 'プ', 'ヘ': 'ペ', 'ホ': 'ポ',
        };
        return handakuten[ch] || ch + '゜';
    });
    return result;
}

// 注文書PDFの構造
interface OrderPDFData {
    orderNumber: string;
    date: Date;
    toCompany: string;
    fromCompany: string;
    deliveryName: string;
    items: Array<{
        name: string;
        quantity: number;
        unit: string;
        unitPrice: number;
        amount: number;
    }>;
    note: string;
}

// PDFDocument生成（Excel雛形に準拠したレイアウト）
async function generateOrderPDF(data: OrderPDFData): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({
                size: "A4",
                margins: { top: 40, bottom: 40, left: 40, right: 40 },
                font: FONT_PATH,
            });

            const chunks: Buffer[] = [];
            doc.on("data", (chunk: Buffer) => chunks.push(chunk));
            doc.on("end", () => resolve(Buffer.concat(chunks)));
            doc.on("error", reject);

            const pageWidth = 595.28; // A4
            const leftMargin = 40;
            const rightMargin = pageWidth - 40;
            const contentWidth = rightMargin - leftMargin;

            // === ヘッダー ===

            // 右上: No.
            doc.fontSize(9)
                .text(`No. ${data.orderNumber}`, rightMargin - 120, 40, { width: 120, align: "right" });

            // タイトル: 注　文　書
            doc.fontSize(20)
                .text("注　　文　　書", leftMargin, 55, { width: contentWidth, align: "center" });

            // 日付
            const dateY = 95;
            const dateStr = `${data.date.getFullYear()}年${data.date.getMonth() + 1}月${data.date.getDate()}日`;
            doc.fontSize(10)
                .text(dateStr, leftMargin, dateY);

            // 宛先
            const toY = 120;
            doc.fontSize(11)
                .text(`${data.toCompany}　御中`, leftMargin, toY);

            // 下線
            doc.moveTo(leftMargin, toY + 18)
                .lineTo(leftMargin + 280, toY + 18)
                .stroke();

            // === 右側: 差出元情報 ===
            const companyX = 340;
            const companyY = 120;
            doc.fontSize(10)
                .text(`　　　${data.fromCompany}`, companyX, companyY)
                .text("　　　　　兵庫県姫路市米屋町20番地", companyX, companyY + 16)
                .text("　　　　　　　　　TEL：　079-225-0300", companyX, companyY + 32)
                .text("　　　　　　　　　FAX：　079-225-0313", companyX, companyY + 48);

            // 挨拶文
            const greetY = 185;
            doc.fontSize(9)
                .text("平素より格別のお引き立てを賜り厚く御礼申し上げます。", leftMargin, greetY)
                .text("下記の通り注文しますのでよろしくお願いします。", leftMargin, greetY + 14);

            // === 合計金額 ===
            const subtotal = data.items.reduce((sum, item) => sum + item.amount, 0);
            const tax = Math.floor(subtotal * 0.1);
            const total = subtotal + tax;

            const totalY = 225;
            doc.fontSize(11)
                .text("合計金額", leftMargin, totalY);

            // 金額ボックス
            doc.rect(leftMargin + 80, totalY - 3, 160, 22)
                .stroke();
            doc.fontSize(13)
                .text(`¥ ${formatPrice(total)}`, leftMargin + 85, totalY + 1, { width: 150, align: "right" });
            doc.fontSize(9)
                .text("（税込）", leftMargin + 245, totalY + 4);

            // === 名称行（備考/納品先情報） ===
            const nameY = 260;
            doc.fontSize(9)
                .text(`名称：　${data.deliveryName}入れ`, leftMargin, nameY);

            // === テーブル ===
            const tableY = 285;
            const colWidths = [235, 50, 50, 90, 90]; // 名称, 数量, 単位, 単価, 金額 (=515.28)
            const colX = [leftMargin];
            for (let i = 0; i < colWidths.length; i++) {
                colX.push(colX[i] + colWidths[i]);
            }

            // テーブルヘッダー
            const headerH = 22;
            doc.rect(leftMargin, tableY, contentWidth, headerH).stroke();
            doc.fontSize(9);

            const headers = ["名　　　称", "数量", "単位", "単価", "金額"];
            headers.forEach((h, i) => {
                doc.text(h, colX[i] + 4, tableY + 6, {
                    width: colWidths[i] - 8,
                    align: i >= 1 ? "center" : "left",
                });
                // 列区切り線
                if (i > 0) {
                    doc.moveTo(colX[i], tableY)
                        .lineTo(colX[i], tableY + headerH)
                        .stroke();
                }
            });

            // テーブル行（最大15行）
            const rowH = 18;
            const maxRows = 15;
            let y = tableY + headerH;

            for (let r = 0; r < maxRows; r++) {
                const item = data.items[r];
                doc.rect(leftMargin, y, contentWidth, rowH).stroke();

                // 列区切り線
                for (let i = 1; i < colWidths.length; i++) {
                    doc.moveTo(colX[i], y).lineTo(colX[i], y + rowH).stroke();
                }

                if (item) {
                    doc.fontSize(8.5);
                    doc.text(item.name, colX[0] + 4, y + 4, { width: colWidths[0] - 8 });
                    doc.text(item.quantity > 0 ? String(item.quantity) : "", colX[1] + 4, y + 4, {
                        width: colWidths[1] - 8, align: "center"
                    });
                    doc.text(item.unit, colX[2] + 4, y + 4, { width: colWidths[2] - 8, align: "center" });
                    doc.text(item.unitPrice > 0 ? formatPrice(item.unitPrice) : "", colX[3] + 4, y + 4, {
                        width: colWidths[3] - 12, align: "right"
                    });
                    doc.text(item.amount > 0 ? formatPrice(item.amount) : "", colX[4] + 4, y + 4, {
                        width: colWidths[4] - 12, align: "right"
                    });
                }
                y += rowH;
            }

            // 空行（テーブル埋め）
            const emptyRows = 2;
            for (let r = 0; r < emptyRows; r++) {
                doc.rect(leftMargin, y, contentWidth, rowH).stroke();
                for (let i = 1; i < colWidths.length; i++) {
                    doc.moveTo(colX[i], y).lineTo(colX[i], y + rowH).stroke();
                }
                y += rowH;
            }

            // === 小計・消費税・合計 ===
            const summaryLabels = ["小計", "消費税", "合計"];
            const summaryValues = [subtotal, tax, total];

            summaryLabels.forEach((label, i) => {
                doc.rect(leftMargin, y, contentWidth, rowH).stroke();
                for (let ci = 1; ci < colWidths.length; ci++) {
                    doc.moveTo(colX[ci], y).lineTo(colX[ci], y + rowH).stroke();
                }
                doc.fontSize(9)
                    .text(label, colX[0] + 4, y + 4, { width: colWidths[0] - 8 });
                doc.text(formatPrice(summaryValues[i]), colX[4] + 4, y + 4, {
                    width: colWidths[4] - 12, align: "right"
                });
                y += rowH;
            });

            // === 備考欄 ===
            y += 8;
            doc.fontSize(8)
                .text("備考", leftMargin, y);
            if (data.note) {
                doc.fontSize(8)
                    .text(data.note, leftMargin + 30, y);
            }

            doc.end();
        } catch (err) {
            reject(err);
        }
    });
}
