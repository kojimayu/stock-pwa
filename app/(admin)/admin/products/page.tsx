import { getProducts } from "@/lib/actions";
import { ProductList } from "@/components/admin/product-list";
import { prisma } from "@/lib/prisma";
import { Search, CheckCircle, AlertTriangle, HelpCircle } from "lucide-react";

async function getRecentDiscrepancies() {
    const since = new Date();
    since.setDate(since.getDate() - 7);

    const adjustments = await prisma.inventoryLog.findMany({
        where: {
            createdAt: { gte: since },
            type: { in: ['CORRECTION', 'DISPOSAL', 'INVENTORY_ADJUSTMENT'] },
        },
        include: {
            product: { select: { id: true, name: true, code: true, category: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
    });

    const txSince = new Date();
    txSince.setDate(txSince.getDate() - 30);
    const transactions = await prisma.transaction.findMany({
        where: { date: { gte: txSince }, isReturned: false },
        include: { vendor: { select: { name: true } } },
        orderBy: { date: 'desc' },
        take: 100,
    });

    const results = [];
    for (const adj of adjustments) {
        if (!adj.product || adj.quantity === 0) continue;
        const absQty = Math.abs(adj.quantity);
        let best: any = null;

        for (const tx of transactions) {
            let items: any[];
            try { items = JSON.parse(tx.items); } catch { continue; }
            for (const item of items) {
                if (!item.quantity) continue;
                const qtyDiff = Math.abs(Math.abs(item.quantity) - absQty);
                if (qtyDiff > 5) continue;

                let score = 0;
                if (qtyDiff === 0) score += 40;
                else if (qtyDiff <= 1) score += 30;
                else if (qtyDiff <= 3) score += 20;
                else score += 10;

                if (item.productId === adj.productId) score += 25;
                score += 15;

                const days = Math.floor((Date.now() - tx.date.getTime()) / 86400000);
                if (days <= 3) score += 20;
                else if (days <= 7) score += 15;
                else if (days <= 14) score += 10;
                else score += 5;

                if (score > (best?.score || 0)) {
                    best = {
                        vendorName: tx.vendor?.name || '不明',
                        productName: item.name || '不明',
                        productCode: item.code || '',
                        quantity: item.quantity,
                        score,
                        date: tx.date,
                    };
                }
            }
        }

        if (best && best.score >= 40) {
            results.push({
                id: adj.id,
                productName: adj.product.name,
                productCode: adj.product.code,
                quantity: adj.quantity,
                reason: adj.reason,
                adjustedAt: adj.createdAt,
                candidate: best,
            });
        }
    }
    return results;
}

export default async function ProductsPage() {
    const [products, discrepancies] = await Promise.all([
        getProducts(),
        getRecentDiscrepancies(),
    ]);

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-3xl font-bold tracking-tight">商品管理</h2>
                <p className="text-muted-foreground">出庫対象の商品・在庫の管理</p>
            </div>

            {/* 在庫差異の推測パネル */}
            {discrepancies.length > 0 && (
                <div className="border rounded-lg p-4 bg-purple-50/50 space-y-2">
                    <div className="flex items-center gap-2 mb-2">
                        <Search className="w-4 h-4 text-purple-600" />
                        <span className="text-sm font-semibold text-purple-800">
                            🔍 在庫差異の推測候補 ({discrepancies.length}件)
                        </span>
                    </div>
                    <div className="space-y-1.5">
                        {discrepancies.map((d) => {
                            const Icon = d.candidate.score >= 75 ? CheckCircle
                                : d.candidate.score >= 50 ? AlertTriangle : HelpCircle;
                            const color = d.candidate.score >= 75 ? 'green'
                                : d.candidate.score >= 50 ? 'amber' : 'slate';
                            const dateStr = new Date(d.candidate.date).toLocaleDateString('ja-JP', {
                                month: 'short', day: 'numeric',
                            });
                            const adjDateStr = new Date(d.adjustedAt).toLocaleDateString('ja-JP', {
                                month: 'short', day: 'numeric',
                            });
                            return (
                                <div
                                    key={d.id}
                                    className={`flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 px-3 py-2 rounded border text-sm bg-${color}-50 border-${color}-200`}
                                >
                                    <div className="flex items-center gap-2 min-w-0">
                                        <Icon className={`w-3.5 h-3.5 shrink-0 text-${color}-600`} />
                                        <span className={`text-xs font-bold text-${color}-600 min-w-[32px]`}>
                                            {d.candidate.score}%
                                        </span>
                                        <span className="text-slate-800 font-medium truncate">
                                            {d.productCode || d.productName}
                                        </span>
                                        <span className="text-slate-500 text-xs shrink-0">
                                            {adjDateStr} 調整{d.quantity > 0 ? '+' : ''}{d.quantity}個
                                        </span>
                                    </div>
                                    <div className="text-xs text-slate-600 sm:ml-auto shrink-0">
                                        → {dateStr} {d.candidate.vendorName}
                                        「{d.candidate.productCode || d.candidate.productName}」
                                        {d.candidate.quantity}個
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                        ※ 過去7日の在庫調整 × 過去30日の取引からスコアリングで推測
                    </p>
                </div>
            )}

            <ProductList products={products} />
        </div>
    );
}
