import { getProducts } from "@/lib/actions";
import { ProductList } from "@/components/admin/product-list";
import { prisma } from "@/lib/prisma";
import { ArrowLeftRight, Search } from "lucide-react";

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

export default async function ProductsPage() {
    const [products, swapPairs] = await Promise.all([
        getProducts(),
        detectSwapPairs(),
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

            <ProductList products={products} />
        </div>
    );
}
