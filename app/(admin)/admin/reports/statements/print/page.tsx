import { getMonthlyStatements } from "@/lib/actions";
import type { VendorStatement, StatementItem, AirconStatementItem } from "@/lib/actions";

function formatDate(dateStr: string) {
    const d = new Date(dateStr + 'T00:00:00');
    return `${d.getMonth() + 1}/${d.getDate()}`;
}

function formatCurrency(amount: number) {
    return `¥${amount.toLocaleString()}`;
}

function typeLabel(type: string) {
    switch (type) {
        case 'SET': return 'セット';
        case 'INDOOR': return '内機';
        case 'OUTDOOR': return '外機';
        default: return type;
    }
}

function todayString() {
    const now = new Date();
    const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    return `${jst.getUTCFullYear()}年${jst.getUTCMonth() + 1}月${jst.getUTCDate()}日`;
}

// Material Statement Page
function MaterialStatement({ vendor, year, month, issueDate }: { vendor: VendorStatement; year: number; month: number; issueDate: string }) {
    if (vendor.materialItems.length === 0) return null;
    return (
        <div className="statement-page">
            <div className="statement-header">
                <div className="statement-title">
                    <h1>材料明細書</h1>
                    <p className="period">{year}年{month}月分</p>
                </div>
                <div className="vendor-info">
                    <p className="vendor-name">{vendor.vendorName} 御中</p>
                </div>
                <div className="company-info">
                    <p>㈱プラスカンパニー</p>
                    <p className="issue-date">発行日: {issueDate}</p>
                </div>
            </div>

            <table className="statement-table">
                <thead>
                    <tr>
                        <th className="col-no">No</th>
                        <th className="col-date">日付</th>
                        <th className="col-id">伝票</th>
                        <th className="col-code">コード</th>
                        <th className="col-name">品名</th>
                        <th className="col-qty">数量</th>
                        <th className="col-unit">単位</th>
                        <th className="col-price">単価</th>
                        <th className="col-subtotal">金額</th>
                    </tr>
                </thead>
                <tbody>
                    {vendor.materialItems.map((item, idx) => (
                        <tr key={idx} className={item.isReturn ? 'return-row' : ''}>
                            <td className="col-no">{idx + 1}</td>
                            <td className="col-date">{formatDate(item.date)}</td>
                            <td className="col-id">#{item.txId}</td>
                            <td className="col-code">{item.code}</td>
                            <td className="col-name">{item.name}</td>
                            <td className="col-qty">{item.quantity.toLocaleString()}</td>
                            <td className="col-unit">{item.unit}</td>
                            <td className="col-price">{formatCurrency(item.unitPrice)}</td>
                            <td className="col-subtotal">{formatCurrency(item.subtotal)}</td>
                        </tr>
                    ))}
                </tbody>
                <tfoot>
                    <tr>
                        <td colSpan={8} className="total-label" style={{ textAlign: 'right', padding: '5px 8px', borderTop: '1px solid #cbd5e1' }}>小計</td>
                        <td className="col-subtotal" style={{ borderTop: '1px solid #cbd5e1' }}>{formatCurrency(vendor.materialTotal)}</td>
                    </tr>
                    <tr>
                        <td colSpan={8} className="total-label" style={{ textAlign: 'right', padding: '5px 8px' }}>消費税（10%）</td>
                        <td className="col-subtotal">{formatCurrency(Math.round(vendor.materialTotal * 0.1))}</td>
                    </tr>
                    <tr className="total-row">
                        <td colSpan={8} className="total-label">合計（税込）</td>
                        <td className="total-amount">{formatCurrency(vendor.materialTotal + Math.round(vendor.materialTotal * 0.1))}</td>
                    </tr>
                </tfoot>
            </table>

            {/* 備考欄 */}
            <div className="remarks-section">
                <p className="remarks-label">備考</p>
                <div className="remarks-content" contentEditable suppressContentEditableWarning>
                </div>
            </div>
        </div>
    );
}

// Aircon Statement Page
function AirconStatement({ vendor, year, month, issueDate }: { vendor: VendorStatement; year: number; month: number; issueDate: string }) {
    if (vendor.airconItems.length === 0) return null;
    return (
        <div className="statement-page">
            <div className="statement-header">
                <div className="statement-title">
                    <h1>エアコン明細書</h1>
                    <p className="period">{year}年{month}月分</p>
                </div>
                <div className="vendor-info">
                    <p className="vendor-name">{vendor.vendorName} 御中</p>
                </div>
                <div className="company-info">
                    <p>㈱プラスカンパニー</p>
                    <p className="issue-date">発行日: {issueDate}</p>
                </div>
            </div>

            <table className="statement-table">
                <thead>
                    <tr>
                        <th className="col-no">No</th>
                        <th className="col-date">日付</th>
                        <th className="col-mgmt">管理No</th>
                        <th className="col-model">型番</th>
                        <th className="col-cap">容量</th>
                        <th className="col-type">種別</th>
                        <th className="col-subtotal">金額</th>
                    </tr>
                </thead>
                <tbody>
                    {vendor.airconItems.map((item, idx) => (
                        <tr key={idx} className={item.isReturn ? 'return-row' : ''}>
                            <td className="col-no">{idx + 1}</td>
                            <td className="col-date">{formatDate(item.date)}</td>
                            <td className="col-mgmt">{item.managementNo}</td>
                            <td className="col-model">{item.modelNumber}</td>
                            <td className="col-cap">{item.capacity}</td>
                            <td className="col-type">{typeLabel(item.type)}</td>
                            <td className="col-subtotal">
                                {item.isReturn ? '(返品)' : formatCurrency(item.unitPrice)}
                            </td>
                        </tr>
                    ))}
                </tbody>
                <tfoot>
                    <tr>
                        <td colSpan={6} className="total-label" style={{ textAlign: 'right', padding: '5px 8px', borderTop: '1px solid #cbd5e1' }}>小計</td>
                        <td className="col-subtotal" style={{ borderTop: '1px solid #cbd5e1' }}>{formatCurrency(vendor.airconTotal)}</td>
                    </tr>
                    <tr>
                        <td colSpan={6} className="total-label" style={{ textAlign: 'right', padding: '5px 8px' }}>消費税（10%）</td>
                        <td className="col-subtotal">{formatCurrency(Math.round(vendor.airconTotal * 0.1))}</td>
                    </tr>
                    <tr className="total-row">
                        <td colSpan={6} className="total-label">合計（税込）</td>
                        <td className="total-amount">{formatCurrency(vendor.airconTotal + Math.round(vendor.airconTotal * 0.1))}</td>
                    </tr>
                </tfoot>
            </table>

            {/* 備考欄 */}
            <div className="remarks-section">
                <p className="remarks-label">備考</p>
                <div className="remarks-content" contentEditable suppressContentEditableWarning>
                </div>
            </div>
        </div>
    );
}

export default async function StatementPrintPage({
    searchParams,
}: {
    searchParams: Promise<{ year?: string; month?: string }>;
}) {
    const params = await searchParams;
    const year = parseInt(params.year || String(new Date().getFullYear()), 10);
    const month = parseInt(params.month || String(new Date().getMonth()), 10);
    const statements = await getMonthlyStatements(year, month);
    const issueDate = todayString();

    return (
        <>
            <style>{`
                @media screen {
                    body { background: #f1f5f9; }
                    .print-controls {
                        position: fixed; top: 0; left: 0; right: 0; z-index: 100;
                        background: #1e293b; color: white; padding: 12px 24px;
                        display: flex; align-items: center; justify-content: space-between;
                        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                    }
                    .print-controls button {
                        background: #3b82f6; color: white; border: none;
                        padding: 8px 20px; border-radius: 6px; font-weight: bold;
                        cursor: pointer; font-size: 14px;
                    }
                    .print-controls button:hover { background: #2563eb; }
                    .print-controls a {
                        color: #94a3b8; text-decoration: none; font-size: 14px;
                    }
                    .print-hint {
                        color: #94a3b8; font-size: 12px;
                    }
                    .statement-page {
                        background: white; width: 210mm; min-height: 297mm;
                        margin: 80px auto 32px; padding: 20mm 15mm;
                        box-shadow: 0 4px 24px rgba(0,0,0,0.1); border-radius: 4px;
                    }
                    .statement-page:first-of-type { margin-top: 80px; }
                    .no-data { text-align: center; padding: 100px 0; color: #64748b; }
                    .remarks-content:hover {
                        background: #f8fafc;
                    }
                    .remarks-content:focus {
                        background: #eff6ff;
                        outline: 2px solid #3b82f6;
                        outline-offset: 2px;
                    }
                }

                @page {
                    size: A4;
                    margin: 12mm 10mm 18mm 10mm;

                    @bottom-center {
                        content: counter(page) " / " counter(pages);
                        font-size: 9px;
                        color: #94a3b8;
                        font-family: sans-serif;
                    }
                }

                @media print {
                    .print-controls { display: none !important; }
                    body { margin: 0; padding: 0; background: white; }
                    /* adminレイアウトのサイドバー・ヘッダー・パディングを非表示 */
                    aside, nav, [class*="sidebar"], [class*="Sidebar"] { display: none !important; }
                    main { margin: 0 !important; padding: 0 !important; }
                    main > div { margin: 0 !important; padding: 0 !important; max-width: none !important; }
                    .flex.h-screen { display: block !important; }
                    [class*="bg-red-600"] { display: none !important; }
                    .statement-page {
                        page-break-after: always;
                        padding: 0;
                        width: 100%; min-height: auto;
                        margin: 0; box-shadow: none; border-radius: 0;
                    }
                    .statement-page:last-child { page-break-after: auto; }

                    /* テーブルヘッダーを各ページで繰り返し */
                    thead { display: table-header-group; }
                    tfoot { display: table-footer-group; }

                    /* 行の途中で改ページを防止 */
                    tr { page-break-inside: avoid; }

                    /* 合計行グループの改ページ防止 */
                    tfoot tr { page-break-inside: avoid; }

                    /* 備考欄 */
                    .remarks-content {
                        border-color: #cbd5e1 !important;
                    }
                    .remarks-content:empty::after {
                        display: none;
                    }
                    /* 備考が空なら非表示 */
                    .remarks-section:has(.remarks-content:empty) {
                        display: none;
                    }
                }

                .statement-header {
                    display: flex; justify-content: space-between; align-items: flex-start;
                    margin-bottom: 24px; padding-bottom: 16px;
                    border-bottom: 2px solid #1e293b;
                }
                .statement-title h1 { font-size: 20px; font-weight: bold; margin: 0; }
                .statement-title .period { font-size: 14px; color: #64748b; margin-top: 4px; }
                .vendor-info { text-align: center; }
                .vendor-name { font-size: 18px; font-weight: bold; }
                .company-info { text-align: right; font-size: 13px; color: #475569; }
                .issue-date { font-size: 11px; color: #94a3b8; margin-top: 4px; }

                .statement-table {
                    width: 100%; border-collapse: collapse; font-size: 12px;
                    margin-top: 8px;
                }
                .statement-table th {
                    background: #f1f5f9; border: 1px solid #cbd5e1;
                    padding: 6px 8px; font-weight: bold; text-align: center;
                    font-size: 11px; color: #334155;
                }
                .statement-table td {
                    border: 1px solid #e2e8f0; padding: 5px 8px;
                    vertical-align: middle;
                }
                .col-no { width: 30px; text-align: center; font-size: 10px; color: #94a3b8; }
                .col-date { width: 55px; text-align: center; }
                .col-id { width: 45px; text-align: center; font-size: 10px; color: #64748b; }
                .col-code { width: 80px; font-size: 10px; }
                .col-name { }
                .col-qty { width: 55px; text-align: right; }
                .col-unit { width: 35px; text-align: center; font-size: 10px; }
                .col-price { width: 70px; text-align: right; }
                .col-subtotal { width: 80px; text-align: right; font-weight: 500; }
                .col-mgmt { width: 90px; }
                .col-model { }
                .col-cap { width: 60px; text-align: center; }
                .col-type { width: 55px; text-align: center; }

                .return-row { color: #dc2626; }
                .return-row td { background: #fef2f2; }

                .total-row td {
                    border-top: 2px solid #1e293b;
                    font-weight: bold; font-size: 13px;
                    padding: 8px;
                }
                .total-label { text-align: right; }
                .total-amount { text-align: right; font-size: 15px; }

                /* 備考欄 */
                .remarks-section {
                    margin-top: 20px;
                    page-break-inside: avoid;
                }
                .remarks-label {
                    font-size: 12px;
                    font-weight: bold;
                    color: #334155;
                    margin-bottom: 4px;
                }
                .remarks-content {
                    min-height: 40px;
                    border: 1px dashed #cbd5e1;
                    border-radius: 4px;
                    padding: 8px 10px;
                    font-size: 12px;
                    color: #334155;
                    line-height: 1.6;
                }
                .remarks-content:empty::after {
                    content: 'クリックして備考を入力...';
                    color: #94a3b8;
                    font-style: italic;
                }
            `}</style>

            <div className="print-controls">
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <a href="/admin/reports/statements">← 戻る</a>
                    <span>{year}年{month}月分 — {statements.length}社</span>
                    <span className="print-hint">💡 備考欄はクリックして編集できます</span>
                </div>
                <button id="print-btn">🖨 印刷 / PDF保存</button>
            </div>

            <script dangerouslySetInnerHTML={{
                __html: `
                document.getElementById('print-btn')?.addEventListener('click', function() { window.print(); });
            ` }} />

            {statements.length === 0 ? (
                <div className="statement-page">
                    <div className="no-data">
                        <p style={{ fontSize: '18px', fontWeight: 'bold' }}>取引データがありません</p>
                        <p>{year}年{month}月の取引はまだ記録されていません。</p>
                    </div>
                </div>
            ) : (
                statements.map((vendor) => (
                    <div key={vendor.vendorId}>
                        <MaterialStatement vendor={vendor} year={year} month={month} issueDate={issueDate} />
                        <AirconStatement vendor={vendor} year={year} month={month} issueDate={issueDate} />
                    </div>
                ))
            )}
        </>
    );
}
