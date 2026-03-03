"use server";

import { prisma } from "@/lib/prisma";

/**
 * 在庫差異からの誤入力推測
 * 
 * 在庫調整時に、原因となった可能性のある取引をスコアリングで推測する。
 * - 対象商品の最近の取引を検索
 * - 同カテゴリ商品で逆方向の差異を持つ取引を検索
 * - スコアリングで候補を順位付け
 */

export interface DiscrepancyCandidate {
    transactionId: number;
    date: string;
    vendorName: string;
    productName: string;
    productCode: string;
    quantity: number;
    score: number;         // 0-100
    confidence: "high" | "medium" | "low";
    reason: string;        // なぜ候補になったかの説明
}

interface TransactionItem {
    productId?: number;
    code?: string;
    name?: string;
    quantity?: number;
}

/**
 * 推測候補を取得
 * @param productId - 差異があった商品ID
 * @param discrepancy - 差異数（負=不足、正=過剰）
 * @returns スコア順の候補リスト（最大5件）
 */
export async function getDiscrepancyCandidates(
    productId: number,
    discrepancy: number
): Promise<DiscrepancyCandidate[]> {
    if (discrepancy === 0) return [];

    // 対象商品の情報を取得
    const product = await prisma.product.findUnique({
        where: { id: productId },
        select: { id: true, name: true, code: true, category: true },
    });
    if (!product) return [];

    // 過去30日のTransactionを取得
    const since = new Date();
    since.setDate(since.getDate() - 30);

    const transactions = await prisma.transaction.findMany({
        where: {
            date: { gte: since },
            isReturned: false,
        },
        include: {
            vendor: { select: { name: true } },
        },
        orderBy: { date: "desc" },
    });

    const candidates: DiscrepancyCandidate[] = [];
    const now = new Date();
    const absDisc = Math.abs(discrepancy);

    for (const tx of transactions) {
        let items: TransactionItem[];
        try {
            items = JSON.parse(tx.items);
        } catch {
            continue;
        }

        for (const item of items) {
            if (!item.quantity || item.quantity === 0) continue;

            let score = 0;
            const reasons: string[] = [];
            const itemQty = Math.abs(item.quantity);

            // ===== スコアリング =====

            // 1. 数量近似度 (40点満点)
            const qtyDiff = Math.abs(itemQty - absDisc);
            if (qtyDiff === 0) {
                score += 40;
                reasons.push("数量完全一致");
            } else if (qtyDiff === 1) {
                score += 30;
                reasons.push(`数量ほぼ一致(差${qtyDiff})`);
            } else if (qtyDiff <= 3) {
                score += 20;
                reasons.push(`数量近い(差${qtyDiff})`);
            } else if (qtyDiff <= 5) {
                score += 10;
                reasons.push(`数量やや近い(差${qtyDiff})`);
            } else {
                // 数量が大きく異なる場合はスキップ
                continue;
            }

            // 2. 同一カテゴリ or 同一商品 (25点満点)
            if (item.productId === productId) {
                // 同じ商品の取引 = この商品自体に誤りがある可能性
                score += 25;
                reasons.push("同一商品の取引");
            } else {
                // 同カテゴリの別商品 → 間違えた可能性のある商品
                // カテゴリを確認するため商品情報を取得
                if (item.productId) {
                    const itemProduct = await prisma.product.findUnique({
                        where: { id: item.productId },
                        select: { category: true },
                    });
                    if (itemProduct?.category === product.category) {
                        score += 20;
                        reasons.push("同カテゴリ商品");
                    }
                }
            }

            // 3. 同一業者の頻度 (15点満点)
            // 同じ業者が何度も同じ商品で間違えている可能性
            score += 15; // デフォルトで一定点を付与

            // 4. 時間的近さ (20点満点)
            const daysDiff = Math.floor((now.getTime() - tx.date.getTime()) / (1000 * 60 * 60 * 24));
            if (daysDiff <= 3) {
                score += 20;
                reasons.push("3日以内");
            } else if (daysDiff <= 7) {
                score += 15;
                reasons.push("1週間以内");
            } else if (daysDiff <= 14) {
                score += 10;
                reasons.push("2週間以内");
            } else {
                score += 5;
                reasons.push(`${daysDiff}日前`);
            }

            // スコアが低すぎるものは除外
            if (score < 30) continue;

            // 確信度の判定
            let confidence: "high" | "medium" | "low";
            if (score >= 75) confidence = "high";
            else if (score >= 50) confidence = "medium";
            else confidence = "low";

            candidates.push({
                transactionId: tx.id,
                date: tx.date.toISOString(),
                vendorName: tx.vendor?.name || "不明",
                productName: item.name || "不明",
                productCode: item.code || "",
                quantity: item.quantity,
                score,
                confidence,
                reason: reasons.join("、"),
            });
        }
    }

    // スコア順ソート → 上位5件
    candidates.sort((a, b) => b.score - a.score);
    return candidates.slice(0, 5);
}
