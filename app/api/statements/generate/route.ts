import { NextRequest, NextResponse } from "next/server";
import { getMonthlyStatements, closeMonth, isMonthClosed, getMonthlyCloseInfo } from "@/lib/actions";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const pdfkit = require("pdfkit") as any;
const PDFDocument = pdfkit.default || pdfkit;
import path from "path";
import fs from "fs";
import archiver from "archiver";

const FONT_PATH = path.join(process.cwd(), "fonts", "NotoSansJP-Regular.ttf");

// 文字正規化
function normalizeText(text: string): string {
    let result = text.replace(/㈱/g, "株式会社").replace(/㈲/g, "有限会社");
    const halfToFull: Record<string, string> = {
        'ｱ': 'ア', 'ｲ': 'イ', 'ｳ': 'ウ', 'ｴ': 'エ', 'ｵ': 'オ', 'ｶ': 'カ', 'ｷ': 'キ', 'ｸ': 'ク', 'ｹ': 'ケ', 'ｺ': 'コ',
        'ｻ': 'サ', 'ｼ': 'シ', 'ｽ': 'ス', 'ｾ': 'セ', 'ｿ': 'ソ', 'ﾀ': 'タ', 'ﾁ': 'チ', 'ﾂ': 'ツ', 'ﾃ': 'テ', 'ﾄ': 'ト',
        'ﾅ': 'ナ', 'ﾆ': 'ニ', 'ﾇ': 'ヌ', 'ﾈ': 'ネ', 'ﾉ': 'ノ', 'ﾊ': 'ハ', 'ﾋ': 'ヒ', 'ﾌ': 'フ', 'ﾍ': 'ヘ', 'ﾎ': 'ホ',
        'ﾏ': 'マ', 'ﾐ': 'ミ', 'ﾑ': 'ム', 'ﾒ': 'メ', 'ﾓ': 'モ', 'ﾔ': 'ヤ', 'ﾕ': 'ユ', 'ﾖ': 'ヨ',
        'ﾗ': 'ラ', 'ﾘ': 'リ', 'ﾙ': 'ル', 'ﾚ': 'レ', 'ﾛ': 'ロ', 'ﾜ': 'ワ', 'ｦ': 'ヲ', 'ﾝ': 'ン',
        'ﾞ': '゛', 'ﾟ': '゜', 'ｰ': 'ー', '｡': '。', '｢': '「', '｣': '」', '､': '、',
    };
    result = result.replace(/[ｦ-ﾟ]/g, (ch) => halfToFull[ch] || ch);
    result = result.replace(/(.)゛/g, (_, ch) => {
        const d: Record<string, string> = { 'カ': 'ガ', 'キ': 'ギ', 'ク': 'グ', 'ケ': 'ゲ', 'コ': 'ゴ', 'サ': 'ザ', 'シ': 'ジ', 'ス': 'ズ', 'セ': 'ゼ', 'ソ': 'ゾ', 'タ': 'ダ', 'チ': 'ヂ', 'ツ': 'ヅ', 'テ': 'デ', 'ト': 'ド', 'ハ': 'バ', 'ヒ': 'ビ', 'フ': 'ブ', 'ヘ': 'ベ', 'ホ': 'ボ', 'ウ': 'ヴ' };
        return d[ch] || ch + '゛';
    });
    result = result.replace(/(.)゜/g, (_, ch) => {
        const h: Record<string, string> = { 'ハ': 'パ', 'ヒ': 'ピ', 'フ': 'プ', 'ヘ': 'ペ', 'ホ': 'ポ' };
        return h[ch] || ch + '゜';
    });
    return result;
}

function formatPrice(amount: number): string {
    return `¥${amount.toLocaleString("ja-JP")}`;
}

function generatePDF(doc: any, chunks: Buffer[]): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        doc.on("data", (chunk: Buffer) => chunks.push(chunk));
        doc.on("end", () => resolve(Buffer.concat(chunks)));
        doc.on("error", reject);
    });
}

type StatementRow = { date: string; code?: string; name: string; quantity?: number; unit?: string; unitPrice: number; subtotal: number; note?: string };

function drawStatementPDF(
    title: string,
    vendorName: string,
    year: number,
    month: number,
    rows: StatementRow[],
    subtotalAmount: number,
    columns: { header: string; width: number; align: string }[],
    closedAtLabel?: string,
): Promise<Buffer> {
    const doc = new PDFDocument({
        size: "A4",
        margins: { top: 30, bottom: 30, left: 35, right: 35 },
        font: FONT_PATH,
        bufferPages: true,
    });
    const chunks: Buffer[] = [];
    const promise = generatePDF(doc, chunks);

    const pageWidth = 595.28;
    const pageHeight = 841.89;
    const leftMargin = 35;
    const rightMargin = pageWidth - 35;
    const contentWidth = rightMargin - leftMargin;
    const rowH = 16;
    const colX: number[] = [leftMargin];
    columns.forEach((c) => colX.push(colX[colX.length - 1] + c.width));

    // テーブルヘッダー描画関数（各ページで呼び出し）
    const drawTableHeader = (startY: number): number => {
        doc.rect(leftMargin, startY, contentWidth, rowH + 2).fill("#f1f5f9").stroke("#cbd5e1");
        doc.fillColor("#334155").fontSize(8);
        columns.forEach((c, i) => {
            doc.text(c.header, colX[i] + 3, startY + 4, { width: c.width - 6, align: c.align as any });
            if (i > 0) doc.moveTo(colX[i], startY).lineTo(colX[i], startY + rowH + 2).stroke("#cbd5e1");
        });
        doc.fillColor("#000000");
        return startY + rowH + 2;
    };

    // ページヘッダー描画（2ページ目以降用: タイトル+期間+業者名+テーブルヘッダー）
    const drawPageHeader = (): number => {
        doc.fontSize(16).text(title, leftMargin, 35, { width: contentWidth, align: "center" });
        doc.fontSize(10).text(`${year}年${month}月分`, leftMargin, 58, { width: contentWidth, align: "center" });
        doc.fontSize(12).text(`${normalizeText(vendorName)}　御中`, leftMargin, 82);
        doc.moveTo(leftMargin, 98).lineTo(leftMargin + 250, 98).stroke();
        doc.fontSize(9).text("株式会社プラスカンパニー", rightMargin - 180, 82, { width: 180, align: "right" });
        return drawTableHeader(115);
    };

    // 最大Y（フッターエリアを確保: 締め日時+ページ番号分）
    const maxY = 740;

    // 1ページ目ヘッダー
    let y = drawPageHeader();

    // データ行
    for (const row of rows) {
        if (y > maxY) {
            doc.addPage();
            y = drawPageHeader();
        }
        doc.rect(leftMargin, y, contentWidth, rowH).stroke("#e2e8f0");
        columns.forEach((c, i) => {
            if (i > 0) doc.moveTo(colX[i], y).lineTo(colX[i], y + rowH).stroke("#e2e8f0");
        });

        const vals = getRowValues(row, columns);
        doc.fontSize(7.5);
        vals.forEach((val, i) => {
            doc.text(val, colX[i] + 3, y + 4, { width: columns[i].width - 6, align: columns[i].align as any });
        });
        y += rowH;
    }

    // 合計が次ページに溢れる場合
    if (y + 60 > maxY) {
        doc.addPage();
        y = drawPageHeader();
    }

    // 小計・消費税・合計
    y += 4;
    const tax = Math.round(subtotalAmount * 0.1);
    const total = subtotalAmount + tax;
    const summaryX = rightMargin - 200;

    doc.fontSize(9);
    doc.text("小計", summaryX, y, { width: 100, align: "right" });
    doc.text(formatPrice(subtotalAmount), summaryX + 105, y, { width: 90, align: "right" });
    y += 16;
    doc.text("消費税（10%）", summaryX, y, { width: 100, align: "right" });
    doc.text(formatPrice(tax), summaryX + 105, y, { width: 90, align: "right" });
    y += 16;
    doc.moveTo(summaryX, y - 2).lineTo(rightMargin, y - 2).stroke();
    doc.fontSize(11).text("合計（税込）", summaryX, y, { width: 100, align: "right" });
    doc.text(formatPrice(total), summaryX + 105, y, { width: 90, align: "right" });

    // 全ページにフッター（ページ番号+締め日時）を追加
    const totalPages = doc.bufferedPageRange().count;
    for (let i = 0; i < totalPages; i++) {
        doc.switchToPage(i);
        // ページ番号（lineBreak:falseで余計なページ生成を防止）
        doc.fontSize(8).fillColor("#94a3b8")
            .text(`${i + 1} / ${totalPages}`, leftMargin, pageHeight - 25, { width: contentWidth, align: "center", lineBreak: false, height: 12 });
        // 締め日時
        if (closedAtLabel) {
            doc.fontSize(7)
                .text(`締め: ${closedAtLabel}`, leftMargin, pageHeight - 25, { width: contentWidth, align: "right", lineBreak: false, height: 12 });
        }
        doc.fillColor("#000000");
    }

    doc.end();
    return promise;
}

function getRowValues(row: StatementRow, columns: { header: string }[]): string[] {
    return columns.map((c) => {
        switch (c.header) {
            case "日付": return row.date.slice(5).replace("-", "/");
            case "コード": return normalizeText(row.code || "");
            case "品名": case "型番": return normalizeText(row.name);
            case "数量": return row.quantity != null ? row.quantity.toLocaleString() : "";
            case "単位": return row.unit || "";
            case "単価": return formatPrice(row.unitPrice);
            case "金額": return formatPrice(row.subtotal);
            case "管理No": return row.note || "-";
            case "取引No": return row.note || "-";
            case "容量": return row.unit || "-";
            case "種別": return row.code || "";
            default: return "";
        }
    });
}

export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });

        if (!fs.existsSync(FONT_PATH)) {
            return NextResponse.json({ error: "日本語フォントが見つかりません" }, { status: 500 });
        }

        const { year, month } = await request.json();
        if (!year || !month) return NextResponse.json({ error: "year, monthは必須です" }, { status: 400 });

        const statements = await getMonthlyStatements(year, month);
        if (statements.length === 0) {
            return NextResponse.json({ error: `${year}年${month}月の取引データがありません` }, { status: 404 });
        }

        // 締め日時を取得（仮締め/本締めの日時）
        const closeInfo = await getMonthlyCloseInfo(year, month);
        const closedAt = closeInfo?.closedAt ?? new Date();
        const closedAtJST = new Date(closedAt.getTime() + 9 * 60 * 60 * 1000);
        const closedAtLabel = `${closedAtJST.getUTCFullYear()}/${String(closedAtJST.getUTCMonth() + 1).padStart(2, '0')}/${String(closedAtJST.getUTCDate()).padStart(2, '0')} ${String(closedAtJST.getUTCHours()).padStart(2, '0')}:${String(closedAtJST.getUTCMinutes()).padStart(2, '0')}`;

        // 出力用データ構造（メモリ上で保持）
        const pdfBuffers: { name: string; buf: Buffer }[] = [];

        const materialCols = [
            { header: "日付", width: 50, align: "center" },
            { header: "取引No", width: 40, align: "center" },
            { header: "コード", width: 65, align: "left" },
            { header: "品名", width: 155, align: "left" },
            { header: "数量", width: 40, align: "right" },
            { header: "単位", width: 30, align: "center" },
            { header: "単価", width: 65, align: "right" },
            { header: "金額", width: 80, align: "right" },
        ];
        const airconCols = [
            { header: "日付", width: 55, align: "center" },
            { header: "管理No", width: 85, align: "left" },
            { header: "型番", width: 170, align: "left" },
            { header: "容量", width: 55, align: "center" },
            { header: "種別", width: 55, align: "center" },
            { header: "金額", width: 105, align: "right" },
        ];

        const fileList: { vendor: string; type: string; file: string; subtotal: number; tax: number; total: number }[] = [];

        for (const vendor of statements) {
            const safeName = normalizeText(vendor.vendorName).replace(/[/\\:*?"<>|]/g, "_");

            // 材料PDF
            if (vendor.materialItems.length > 0) {
                const rows: StatementRow[] = vendor.materialItems.map(i => ({
                    date: i.date, code: i.code, name: i.name,
                    quantity: i.quantity, unit: i.unit,
                    unitPrice: i.unitPrice, subtotal: i.subtotal,
                    note: `#${i.txId}`,
                }));
                const buf = await drawStatementPDF("材料明細書", vendor.vendorName, year, month, rows, vendor.materialTotal, materialCols, closedAtLabel);
                const fileName = `材料_${safeName}.pdf`;
                pdfBuffers.push({ name: fileName, buf });
                const tax = Math.round(vendor.materialTotal * 0.1);
                fileList.push({ vendor: vendor.vendorName, type: "材料", file: fileName, subtotal: vendor.materialTotal, tax, total: vendor.materialTotal + tax });
            }

            // エアコンPDF
            if (vendor.airconItems.length > 0) {
                const rows: StatementRow[] = vendor.airconItems.map(i => ({
                    date: i.date, name: i.modelNumber,
                    unitPrice: i.unitPrice, subtotal: i.unitPrice,
                    note: i.managementNo, unit: i.capacity, code: i.type === "SET" ? "セット" : i.type === "INDOOR" ? "内機" : "外機",
                }));
                const buf = await drawStatementPDF("エアコン明細書", vendor.vendorName, year, month, rows, vendor.airconTotal, airconCols, closedAtLabel);
                const fileName = `エアコン_${safeName}.pdf`;
                pdfBuffers.push({ name: fileName, buf });
                const tax = Math.round(vendor.airconTotal * 0.1);
                fileList.push({ vendor: vendor.vendorName, type: "エアコン", file: fileName, subtotal: vendor.airconTotal, tax, total: vendor.airconTotal + tax });
            }
        }

        // チェックCSV生成（メモリ上）
        let grandTotal = 0;
        const csvLines = ["業者名,種別,小計,消費税,税込合計"];
        for (const f of fileList) {
            csvLines.push(`${f.vendor},${f.type},${f.subtotal},${f.tax},${f.total}`);
            grandTotal += f.total;
        }
        csvLines.push(`合計,,,, ${grandTotal}`);
        const csvContent = "\ufeff" + csvLines.join("\n");
        const csvFileName = `チェックリスト_${year}-${String(month).padStart(2, "0")}.csv`;

        // チェックリストPDF生成（メモリ上）
        const checklistPdfFileName = `チェックリスト_${year}-${String(month).padStart(2, "0")}.pdf`;
        const checkDoc = new PDFDocument({
            size: "A4",
            margins: { top: 30, bottom: 30, left: 35, right: 35 },
            font: FONT_PATH,
        });
        const checkChunks: Buffer[] = [];
        const checkPromise = generatePDF(checkDoc, checkChunks);

        const cpw = 595.28;
        const cph = 841.89;
        const clm = 35;
        const crm = cpw - 35;
        const ccw = crm - clm;

        checkDoc.fontSize(16).text("チェックリスト", clm, 35, { width: ccw, align: "center" });
        checkDoc.fontSize(10).text(`${year}年${month}月分`, clm, 58, { width: ccw, align: "center" });
        checkDoc.fontSize(9).text("株式会社プラスカンパニー", crm - 180, 75, { width: 180, align: "right" });

        const checkCols = [
            { header: "No", width: 30, align: "center" },
            { header: "業者名", width: 200, align: "left" },
            { header: "種別", width: 60, align: "center" },
            { header: "小計", width: 80, align: "right" },
            { header: "消費税", width: 70, align: "right" },
            { header: "税込合計", width: 85, align: "right" },
        ];
        const checkColX: number[] = [clm];
        checkCols.forEach(c => checkColX.push(checkColX[checkColX.length - 1] + c.width));

        let cy = 95;
        const crh = 18;

        checkDoc.rect(clm, cy, ccw, crh + 2).fill("#f1f5f9").stroke("#cbd5e1");
        checkDoc.fillColor("#334155").fontSize(9);
        checkCols.forEach((c, i) => {
            checkDoc.text(c.header, checkColX[i] + 3, cy + 5, { width: c.width - 6, align: c.align as any });
            if (i > 0) checkDoc.moveTo(checkColX[i], cy).lineTo(checkColX[i], cy + crh + 2).stroke("#cbd5e1");
        });
        cy += crh + 2;

        checkDoc.fillColor("#000000").fontSize(8.5);
        fileList.forEach((f, idx) => {
            checkDoc.rect(clm, cy, ccw, crh).stroke("#e2e8f0");
            checkCols.forEach((c, i) => {
                if (i > 0) checkDoc.moveTo(checkColX[i], cy).lineTo(checkColX[i], cy + crh).stroke("#e2e8f0");
            });
            const vals = [
                String(idx + 1),
                normalizeText(f.vendor),
                f.type,
                formatPrice(f.subtotal),
                formatPrice(f.tax),
                formatPrice(f.total),
            ];
            vals.forEach((val, i) => {
                checkDoc.text(val, checkColX[i] + 3, cy + 5, { width: checkCols[i].width - 6, align: checkCols[i].align as any });
            });
            cy += crh;
        });

        cy += 4;
        checkDoc.moveTo(clm, cy).lineTo(crm, cy).stroke("#1e293b");
        cy += 4;
        checkDoc.fontSize(11).font(FONT_PATH);
        checkDoc.text("合計（税込）", clm, cy, { width: ccw - 90, align: "right" });
        checkDoc.text(formatPrice(grandTotal), crm - 88, cy, { width: 85, align: "right" });

        if (closedAtLabel) {
            checkDoc.fontSize(7).fillColor("#94a3b8")
                .text(`締め: ${closedAtLabel}`, clm, cph - 25, { width: ccw, align: "right" });
        }

        checkDoc.end();
        const checkBuf = await checkPromise;

        // 月を締める
        const alreadyClosed = await isMonthClosed(year, month);
        if (!alreadyClosed) {
            await closeMonth(year, month, session.user?.name || session.user?.email || undefined);
        }

        // メモリ上でZIP生成
        const zipBuffer = await new Promise<Buffer>((resolve, reject) => {
            const chunks: Buffer[] = [];
            const archive = archiver("zip", { zlib: { level: 9 } });
            archive.on("data", (chunk: Buffer) => chunks.push(chunk));
            archive.on("end", () => resolve(Buffer.concat(chunks)));
            archive.on("error", reject);
            // PDFファイルを追加
            for (const pdf of pdfBuffers) {
                archive.append(pdf.buf, { name: pdf.name });
            }
            // チェックリストPDFを追加
            archive.append(checkBuf, { name: checklistPdfFileName });
            // CSVファイルを追加
            archive.append(csvContent, { name: csvFileName });
            archive.finalize();
        });

        const zipFileName = `明細書_${year}年${String(month).padStart(2, "0")}月.zip`;

        // ZIPバイナリをレスポンスとして返却
        return new NextResponse(zipBuffer as unknown as BodyInit, {
            status: 200,
            headers: {
                "Content-Type": "application/zip",
                "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(zipFileName)}`,
                "Content-Length": zipBuffer.length.toString(),
                "X-Statement-Year": String(year),
                "X-Statement-Month": String(month),
                "X-Statement-VendorCount": String(statements.length),
                "X-Statement-GrandTotal": String(grandTotal),
                "X-Statement-ClosedAt": closedAtLabel,
            },
        });
    } catch (error) {
        console.error("明細生成エラー:", error);
        return NextResponse.json({ error: error instanceof Error ? error.message : "不明なエラー" }, { status: 500 });
    }
}
