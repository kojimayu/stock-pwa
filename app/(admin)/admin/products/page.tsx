import { getProducts } from "@/lib/actions";
import { ProductList } from "@/components/admin/product-list";
import { prisma } from "@/lib/prisma";
import { ArrowLeftRight, Search, TrendingDown, TrendingUp, Calculator } from "lucide-react";

/**
 * ペア検出方式: 不足(-)と過剰(+)の調整をペアにして「商品の取り違え」を検出
 * 
 * 例: 商品A -10個（不足）+ 商品B +10個（過剰）
 * → 「Bを10個持出し登録したが、実際はAだったのでは？」
 */
async function detectSwapPairs() {
    const since = new Date();
    since.setDate(since.getDate() - 7);

    // 過去7日の在庫調整を取得
    const adjustments = await prisma.inventoryLog.findMany({
        where: {
            createdAt: { gte: since },
            type: { in: ['CORRECTION', 'DISPOSAL', 'INVENTORY_ADJUSTMENT'] },
            quantity: { not: 0 },
        },
        include: {
            product: { select: { id: true, name: true, code: true, category: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 30,
    });

    // 不足(-) と 過剰(+) に分ける
    const shortage = adjustments.filter(a => a.quantity < 0);  // 実在庫がシステムより少ない
    const excess = adjustments.filter(a => a.quantity > 0);    // 実在庫がシステムより多い

    // 同一業者の取引情報を取得（スコアリング用）
    const txSince = new Date();
    txSince.setDate(txSince.getDate() - 30);
    const transactions = await prisma.transaction.findMany({
        where: { date: { gte: txSince }, isReturned: false },
        include: { vendor: { select: { id: true, name: true } } },
        orderBy: { date: 'desc' },
        take: 100,
    });

    // 各取引をパース
    const parsedTxs = transactions.map(tx => {
        let items: any[] = [];
        try { items = JSON.parse(tx.items); } catch { /* skip */ }
        return { ...tx, parsedItems: items };
    });

    const pairs: Array<{
        id: string;
        shortageProduct: { code: string; name: string };
        excessProduct: { code: string; name: string };
        shortageQty: number;
        excessQty: number;
        adjustedAt: Date;
        score: number;
        vendorName: string | null;
        txDate: string | null;
    }> = [];

    // ペアマッチング
    const usedExcess = new Set<number>();
    for (const s of shortage) {
        if (!s.product) continue;
        let bestPair: (typeof pairs)[0] | null = null;

        for (const e of excess) {
            if (!e.product || usedExcess.has(e.id)) continue;
            if (e.productId === s.productId) continue;  // 同一商品は除外

            const absS = Math.abs(s.quantity);
            const absE = Math.abs(e.quantity);
            const qtyDiff = Math.abs(absS - absE);

            // 数量が離れすぎはスキップ
            if (qtyDiff > Math.max(absS, absE) * 0.5 + 2) continue;

            let score = 0;

            // 1. 数量一致度 (40点満点)
            if (qtyDiff === 0) { score += 40; }
            else if (qtyDiff === 1) { score += 30; }
            else if (qtyDiff <= 3) { score += 20; }
            else { score += 10; }

            // 2. 同一カテゴリ (15点)
            if (s.product.category === e.product.category) {
                score += 15;
            }

            // 3. 調整日の近さ (15点)
            const daysDiff = Math.abs(s.createdAt.getTime() - e.createdAt.getTime()) / 86400000;
            if (daysDiff < 1) score += 15;
            else if (daysDiff <= 3) score += 10;
            else score += 5;

            // 4. 同一業者の取引にペアの商品が含まれるか (30点)
            let vendorMatch: { vendorName: string; txDate: Date } | null = null;
            for (const tx of parsedTxs) {
                const hasShortageProduct = tx.parsedItems.some(
                    (item: any) => item.productId === s.productId || item.code === s.product!.code
                );
                const hasExcessProduct = tx.parsedItems.some(
                    (item: any) => item.productId === e.productId || item.code === e.product!.code
                );
                // 過剰商品の持出しがある取引を探す (= 間違えて登録された商品)
                if (hasExcessProduct) {
                    score += 15;
                    vendorMatch = { vendorName: tx.vendor?.name || '不明', txDate: tx.date };
                    // さらに同じ取引に不足商品も含まれていれば完璧
                    if (hasShortageProduct) {
                        score += 15;
                    }
                    break;
                }
            }

            if (score > (bestPair?.score || 0)) {
                bestPair = {
                    id: `${s.id}-${e.id}`,
                    shortageProduct: { code: s.product.code, name: s.product.name },
                    excessProduct: { code: e.product.code, name: e.product.name },
                    shortageQty: Math.abs(s.quantity),
                    excessQty: e.quantity,
                    adjustedAt: s.createdAt > e.createdAt ? s.createdAt : e.createdAt,
                    score,
                    vendorName: vendorMatch?.vendorName || null,
                    txDate: vendorMatch?.txDate?.toISOString() || null,
                };
            }
        }

        if (bestPair && bestPair.score >= 35) {
            usedExcess.add(parseInt(bestPair.id.split('-')[1]));
            pairs.push(bestPair);
        }
    }

    pairs.sort((a, b) => b.score - a.score);
    return pairs;
}

/**
 * 在庫差異の金額サマリー（当月）
 * 各調整の 数量 × 仕入値 で金額算出
 */
async function getDiscrepancyCostSummary() {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const adjustments = await prisma.inventoryLog.findMany({
        where: {
            createdAt: { gte: monthStart },
            type: { in: ['CORRECTION', 'DISPOSAL', 'INVENTORY_ADJUSTMENT'] },
            quantity: { not: 0 },
        },
        include: {
            product: { select: { cost: true, name: true, code: true } },
        },
    });

    let plusTotal = 0;   // 過剰在庫の金額
    let minusTotal = 0;  // 不足(損失)の金額
    let plusCount = 0;
    let minusCount = 0;
    const topLosses: { code: string; name: string; amount: number }[] = [];

    for (const adj of adjustments) {
        // 入荷取消し等の操作的なCORRECTIONは除外（実際の損失ではない）
        const reason = (adj.reason || '').toLowerCase();
        if (reason.includes('receipt cancelled') || reason.includes('order #')) continue;

        const cost = adj.product?.cost || 0;
        const amount = Math.abs(adj.quantity) * cost;

        if (adj.quantity > 0) {
            plusTotal += amount;
            plusCount++;
        } else {
            minusTotal += amount;
            minusCount++;
            topLosses.push({
                code: adj.product?.code || '',
                name: adj.product?.name || '不明',
                amount,
            });
        }
    }

    topLosses.sort((a, b) => b.amount - a.amount);

    return {
        monthLabel: `${now.getFullYear()}年${now.getMonth() + 1}月`,
        plusTotal,
        plusCount,
        minusTotal,
        minusCount,
        net: plusTotal - minusTotal,
        topLosses: topLosses.slice(0, 3),
    };
}

export default async function ProductsPage() {
    const [products, swapPairs, costSummary] = await Promise.all([
        getProducts(),
        detectSwapPairs(),
        getDiscrepancyCostSummary(),
    ]);

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-3xl font-bold tracking-tight">商品管理</h2>
                <p className="text-muted-foreground">出庫対象の商品・在庫の管理</p>
            </div>

            {/* 商品取り違え推測パネル */}
            {swapPairs.length > 0 && (
                <div className="border rounded-lg p-4 bg-purple-50/50 space-y-2">
                    <div className="flex items-center gap-2 mb-2">
                        <ArrowLeftRight className="w-4 h-4 text-purple-600" />
                        <span className="text-sm font-semibold text-purple-800">
                            🔄 商品取り違えの可能性 ({swapPairs.length}件)
                        </span>
                    </div>
                    <div className="space-y-2">
                        {swapPairs.map((pair) => {
                            const color = pair.score >= 70 ? 'red'
                                : pair.score >= 50 ? 'amber' : 'slate';
                            const dateStr = new Date(pair.adjustedAt).toLocaleDateString('ja-JP', {
                                month: 'short', day: 'numeric',
                            });
                            return (
                                <div
                                    key={pair.id}
                                    className={`px-3 py-2.5 rounded border text-sm bg-${color}-50 border-${color}-200`}
                                >
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className={`text-xs font-bold text-${color}-600 min-w-[32px]`}>
                                            {pair.score}%
                                        </span>
                                        <span className="text-slate-500 text-xs">{dateStr}</span>
                                        <span className="font-medium text-red-700">
                                            {pair.shortageProduct.code || pair.shortageProduct.name}
                                            <span className="text-red-500 text-xs ml-1">-{pair.shortageQty}個不足</span>
                                        </span>
                                        <ArrowLeftRight className="w-3.5 h-3.5 text-purple-500 shrink-0" />
                                        <span className="font-medium text-green-700">
                                            {pair.excessProduct.code || pair.excessProduct.name}
                                            <span className="text-green-600 text-xs ml-1">+{pair.excessQty}個過剰</span>
                                        </span>
                                    </div>
                                    {pair.vendorName && (
                                        <div className="text-xs text-slate-600 mt-1 pl-9">
                                            → {pair.vendorName} が
                                            「{pair.excessProduct.code}」を持出し登録 →
                                            本当は「{pair.shortageProduct.code}」では？
                                            {pair.txDate && (
                                                <span className="text-slate-400 ml-1">
                                                    ({new Date(pair.txDate).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })})
                                                </span>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                        ※ 過去7日の在庫調整で不足(-) と 過剰(+) をペアにして推測
                    </p>
                </div>
            )}

            {/* 在庫差異金額サマリー */}
            <div className="border rounded-lg p-4 bg-slate-50/50">
                <div className="flex items-center gap-2 mb-3">
                    <Calculator className="w-4 h-4 text-slate-600" />
                    <span className="text-sm font-semibold text-slate-800">
                        💰 在庫調整金額 ({costSummary.monthLabel})
                    </span>
                </div>
                <div className="grid grid-cols-3 gap-3">
                    <div className="px-3 py-2 rounded-lg bg-green-50 border border-green-200 text-center">
                        <TrendingUp className="w-4 h-4 text-green-600 mx-auto mb-1" />
                        <div className="text-xs text-green-700">過剰 ({costSummary.plusCount}件)</div>
                        <div className="text-base font-bold text-green-700">
                            +¥{costSummary.plusTotal.toLocaleString()}
                        </div>
                    </div>
                    <div className="px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-center">
                        <TrendingDown className="w-4 h-4 text-red-600 mx-auto mb-1" />
                        <div className="text-xs text-red-700">不足/損失 ({costSummary.minusCount}件)</div>
                        <div className="text-base font-bold text-red-700">
                            -¥{costSummary.minusTotal.toLocaleString()}
                        </div>
                    </div>
                    <div className={`px-3 py-2 rounded-lg text-center border ${costSummary.net >= 0
                        ? 'bg-blue-50 border-blue-200'
                        : 'bg-orange-50 border-orange-200'
                        }`}>
                        <Calculator className={`w-4 h-4 mx-auto mb-1 ${costSummary.net >= 0 ? 'text-blue-600' : 'text-orange-600'
                            }`} />
                        <div className={`text-xs ${costSummary.net >= 0 ? 'text-blue-700' : 'text-orange-700'
                            }`}>純損益</div>
                        <div className={`text-base font-bold ${costSummary.net >= 0 ? 'text-blue-700' : 'text-orange-700'
                            }`}>
                            {costSummary.net >= 0 ? '+' : '-'}¥{Math.abs(costSummary.net).toLocaleString()}
                        </div>
                    </div>
                </div>
                {costSummary.topLosses.length > 0 && (
                    <div className="mt-2 text-xs text-slate-600">
                        不足上位: {costSummary.topLosses.map(l =>
                            `${l.code || l.name}(¥${l.amount.toLocaleString()})`
                        ).join('、')}
                    </div>
                )}
            </div>

            <ProductList products={products} />
        </div>
    );
}
