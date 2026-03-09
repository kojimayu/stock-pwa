import { getProducts, getCategoryPricingRules } from "@/lib/actions";
import { ProductList } from "@/components/admin/product-list";
import { prisma } from "@/lib/prisma";
import { TrendingDown, TrendingUp, Calculator } from "lucide-react";
import { CollapsiblePanel } from "@/components/admin/collapsible-panel";
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
    const details: { code: string; name: string; quantity: number; cost: number; amount: number; date: Date; reason: string }[] = [];

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

        details.push({
            code: adj.product?.code || '',
            name: adj.product?.name || '不明',
            quantity: adj.quantity,
            cost,
            amount: adj.quantity > 0 ? amount : -amount,
            date: adj.createdAt,
            reason: adj.reason || '',
        });
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
        details: details.sort((a, b) => b.date.getTime() - a.date.getTime()),
    };
}

export default async function ProductsPage() {
    const [products, costSummary, pricingRulesArr] = await Promise.all([
        getProducts(),
        getDiscrepancyCostSummary(),
        getCategoryPricingRules(),
    ]);
    const pricingRules: Record<string, { markupRateA: number; markupRateB: number }> = {};
    for (const r of pricingRulesArr) {
        pricingRules[r.category] = { markupRateA: r.markupRateA, markupRateB: r.markupRateB };
    }

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-3xl font-bold tracking-tight">商品管理</h2>
                <p className="text-muted-foreground">出庫対象の商品・在庫の管理</p>
            </div>

            {/* 在庫差異金額サマリー */}
            <CollapsiblePanel
                title={<span className="text-slate-800">💰 在庫調整金額 ({costSummary.monthLabel})</span>}
                icon={<Calculator className="w-4 h-4 text-slate-600" />}
                className="bg-slate-50/50"
            >
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
                {/* 内訳テーブル */}
                {costSummary.details.length > 0 && (
                    <div className="mt-3 border-t pt-3">
                        <div className="text-xs font-semibold text-slate-700 mb-2">内訳 ({costSummary.details.length}件)</div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                                <thead className="sticky top-0 z-10 bg-white">
                                    <tr className="border-b text-slate-500">
                                        <th className="text-left py-1 pr-2">日付</th>
                                        <th className="text-left py-1 pr-2">商品</th>
                                        <th className="text-right py-1 pr-2">数量</th>
                                        <th className="text-right py-1 pr-2">単価</th>
                                        <th className="text-right py-1">金額</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {costSummary.details.map((d, i) => (
                                        <tr key={i} className="border-b border-slate-100">
                                            <td className="py-1 pr-2 text-slate-500 whitespace-nowrap">
                                                {new Date(d.date).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })}
                                            </td>
                                            <td className="py-1 pr-2 font-medium text-slate-800">
                                                {d.code || d.name}
                                            </td>
                                            <td className={`py-1 pr-2 text-right font-medium ${d.quantity > 0 ? 'text-green-700' : 'text-red-700'
                                                }`}>
                                                {d.quantity > 0 ? '+' : ''}{d.quantity}
                                            </td>
                                            <td className="py-1 pr-2 text-right text-slate-500">
                                                ¥{d.cost.toLocaleString()}
                                            </td>
                                            <td className={`py-1 text-right font-bold ${d.amount >= 0 ? 'text-green-700' : 'text-red-700'
                                                }`}>
                                                {d.amount >= 0 ? '+' : ''}¥{d.amount.toLocaleString()}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </CollapsiblePanel>

            <ProductList products={products} pricingRules={pricingRules} />
        </div>
    );
}
