'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { formatCurrency, formatDate } from '@/lib/utils';

export type LoginState = {
    message?: string;
    success?: boolean;
};

// Helper for Logging
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export type TransactionItem = {
    productId: number;
    quantity: number;
    price: number;
    name: string;
    isManual?: boolean;
    code?: string;
    isBox?: boolean;
    quantityPerBox?: number;
    unit?: string;
};

export async function updateTransaction(transactionId: number, newItems: TransactionItem[]) {
    return await prisma.$transaction(async (tx) => {
        // 1. Fetch current transaction
        const currentTx = await tx.transaction.findUnique({ where: { id: transactionId } });
        if (!currentTx) throw new Error("Transaction not found");

        // 月次締めチェック
        const closed = await checkTransactionMonthClosed(currentTx.date);
        if (closed) {
            throw new Error("この取引の月は締め済みのため編集できません");
        }

        const oldItems: TransactionItem[] = JSON.parse(currentTx.items);
        const processedProductIds = new Set<number>();

        // 2. Process New Items (Updates and Additions)
        for (const newItem of newItems) {
            if (newItem.isManual) continue;

            const oldItem = oldItems.find(i => i.productId === newItem.productId && !i.isManual);
            processedProductIds.add(newItem.productId);

            // Calculate total units (considering box)
            const newTotalUnits = (newItem.isBox && newItem.quantityPerBox) ? newItem.quantity * newItem.quantityPerBox : newItem.quantity;
            const oldTotalUnits = oldItem
                ? ((oldItem.isBox && oldItem.quantityPerBox) ? oldItem.quantity * oldItem.quantityPerBox : oldItem.quantity)
                : 0;

            const adjustment = oldTotalUnits - newTotalUnits;
            // Positive adjustment = User reduced quantity = Return to stock
            // Negative adjustment = User increased quantity = Take from stock

            if (adjustment !== 0) {
                await tx.product.update({
                    where: { id: newItem.productId },
                    data: { stock: { increment: adjustment } }
                });

                // エアコン在庫も連動
                const prodWithAircon = await tx.product.findUnique({
                    where: { id: newItem.productId },
                    select: { airconProductId: true }
                });
                if (prodWithAircon?.airconProductId) {
                    await tx.airconProduct.update({
                        where: { id: prodWithAircon.airconProductId },
                        data: { stock: { increment: adjustment } }
                    });
                }

                await tx.inventoryLog.create({
                    data: {
                        productId: newItem.productId,
                        type: adjustment > 0 ? 'RETURN' : 'OUT',
                        quantity: Math.abs(adjustment),
                        reason: `Correction #${transactionId}: ${adjustment > 0 ? 'Returned' : 'Taken'}`,
                    }
                });
            }
        }

        // 3. Process Removed Items
        for (const oldItem of oldItems) {
            if (oldItem.isManual) continue;
            if (processedProductIds.has(oldItem.productId)) continue;

            // This item was removed efficiently
            const oldTotalUnits = (oldItem.isBox && oldItem.quantityPerBox) ? oldItem.quantity * oldItem.quantityPerBox : oldItem.quantity;

            // Return all to stock
            await tx.product.update({
                where: { id: oldItem.productId },
                data: { stock: { increment: oldTotalUnits } }
            });

            // エアコン在庫も連動（airconProductIdがある場合）
            const productWithAircon = await tx.product.findUnique({
                where: { id: oldItem.productId },
                select: { airconProductId: true }
            });
            if (productWithAircon?.airconProductId) {
                await tx.airconProduct.update({
                    where: { id: productWithAircon.airconProductId },
                    data: { stock: { increment: oldTotalUnits } }
                });
            }

            await tx.inventoryLog.create({
                data: {
                    productId: oldItem.productId,
                    type: 'RETURN',
                    quantity: oldTotalUnits,
                    reason: `Correction #${transactionId}: Item Removed`,
                }
            });
        }

        // 4. Update Transaction
        // Recalculate total amount
        const newTotalAmount = newItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);

        const updatedTx = await tx.transaction.update({
            where: { id: transactionId },
            data: {
                items: JSON.stringify(newItems),
                totalAmount: newTotalAmount,
                // @ts-ignore
                lastModifiedAt: new Date(), // Update last modified time
                // Do not update createdAt or date to preserve history
            }
        });


        // Calculate diff for logging
        const changes: string[] = [];
        // Added items
        for (const newItem of newItems) {
            const oldItem = oldItems.find(i => i.productId === newItem.productId && !!i.isManual === !!newItem.isManual);
            if (!oldItem) {
                changes.push(`[追加] ${newItem.name} x${newItem.quantity}`);
            } else {
                const newQty = newItem.quantity;
                const oldQty = oldItem.quantity;
                if (newQty !== oldQty) {
                    changes.push(`[変更] ${newItem.name}: ${oldQty}→${newQty}`);
                }
            }
        }
        // Removed items
        for (const oldItem of oldItems) {
            const newItem = newItems.find(i => i.productId === oldItem.productId && !!i.isManual === !!oldItem.isManual);
            if (!newItem) {
                changes.push(`[削除] ${oldItem.name} x${oldItem.quantity}`);
            }
        }

        const changeLog = changes.length > 0 ? changes.join(", ") : "詳細なし";

        // 5. Log Operation
        await logOperation("TRANSACTION_UPDATE", `Transaction ID: ${transactionId}`, `金額: ${formatCurrency(currentTx.totalAmount)} -> ${formatCurrency(newTotalAmount)}. 変更点: ${changeLog}`);

        return { success: true, transaction: updatedTx };
    });
}

// Get logs for a specific transaction
export async function getTransactionLogs(transactionId: number) {
    return await prisma.operationLog.findMany({
        where: {
            target: {
                contains: `Transaction ID: ${transactionId}`
            }
        },
        orderBy: { performedAt: 'desc' }
    });
}

export async function logOperation(action: string, target: string, details?: string) {
    // Fire and forget logging to avoid blocking the UI
    (async () => {
        try {
            let executor = "System/Guest";

            // Only check session if it's NOT a Kiosk login action (which doesn't have a session)
            // or if we suspect we might have an admin session.
            if (!action.startsWith("KIOSK_")) {
                const session: any = await Promise.race([
                    getServerSession(authOptions),
                    new Promise(resolve => setTimeout(() => resolve(null), 500))
                ]).catch(() => null);

                if (session?.user?.email) {
                    executor = session.user.email;
                }
            }

            await prisma.operationLog.create({
                data: {
                    action,
                    target,
                    details: `${details || ''} [By: ${executor}]`,
                },
            });
        } catch (e) {
            console.error("Failed to create operation log:", e);
        }
    })();
}

// Vendor Actions - Kiosk用（有効な業者のみ）
export async function getVendors() {
    const vendors = await prisma.vendor.findMany({
        where: { isActive: true },  // 有効な業者のみ
        include: {
            _count: {
                select: { transactions: true }
            }
        }
    });

    // ソート: テスト業者を最後に、それ以外は使用頻度順
    return vendors.sort((a, b) => {
        const aIsTest = a.name.startsWith('テスト');
        const bIsTest = b.name.startsWith('テスト');

        // テスト業者は最後
        if (aIsTest && !bIsTest) return 1;
        if (!aIsTest && bIsTest) return -1;

        // 使用頻度（トランザクション数）の降順
        const aCount = a._count?.transactions || 0;
        const bCount = b._count?.transactions || 0;
        if (aCount !== bCount) return bCount - aCount;

        // 同じ使用頻度なら名前順
        return a.name.localeCompare(b.name, 'ja');
    });
}

// 管理画面用（全業者）- 有効な業者を上に表示
export async function getAllVendors() {
    const vendors = await prisma.vendor.findMany({
        include: {
            _count: {
                select: { transactions: true }
            },
            users: {
                orderBy: { name: 'asc' }
            },
            deliveryLocation: true,
        },
        orderBy: [
            { isActive: 'desc' },  // 有効な業者が先
            { name: 'asc' }
        ]
    });
    return vendors;
}

// 納品先拠点一覧取得
export async function getDeliveryLocations() {
    return prisma.deliveryLocation.findMany({
        where: { isActive: true },
        orderBy: { name: 'asc' },
    });
}

// 業者の有効/無効を切り替え
export async function toggleVendorActive(vendorId: number, isActive: boolean) {
    await prisma.vendor.update({
        where: { id: vendorId },
        data: { isActive }
    });
    await logOperation(
        'VENDOR_TOGGLE_ACTIVE',
        `Vendor ID: ${vendorId}`,
        `有効/無効を変更: ${isActive ? '有効' : '無効'}`
    );
    revalidatePath('/admin/vendors');
    return { success: true };
}

// Accessから業者をインポート
export async function importVendorsFromAccess() {
    try {
        // 1. Access DBから業者リストを取得
        const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
        const response = await fetch(`${baseUrl}/api/access/vendors`, {
            cache: 'no-store'
        });

        if (!response.ok) {
            return { success: false, message: 'Access DBへの接続に失敗しました' };
        }

        const result = await response.json();
        if (!result.success || !result.data) {
            return { success: false, message: 'Access DBからデータを取得できませんでした' };
        }

        const accessVendors: { id: string; name: string }[] = result.data;

        // 2. 既存の業者を取得（accessCompanyNameで照合）
        const existingVendors = await prisma.vendor.findMany({
            select: { accessCompanyName: true, name: true }
        });
        const existingAccessNames = new Set(
            existingVendors.map(v => v.accessCompanyName).filter(Boolean)
        );
        const existingNames = new Set(existingVendors.map(v => v.name));

        // 3. 新規業者のみ登録
        let imported = 0;
        let skipped = 0;

        for (const av of accessVendors) {
            // 既にaccessCompanyNameで紐付けられているか、同名の業者が存在する場合はスキップ
            if (existingAccessNames.has(av.name) || existingNames.has(av.name)) {
                skipped++;
                continue;
            }

            // 新規作成（isActive: false）
            const newVendor = await prisma.vendor.create({
                data: {
                    name: av.name,
                    isActive: false,  // 初期は無効（管理者が有効化）
                    accessCompanyName: av.name
                }
            });

            // デフォルト担当者を作成
            await prisma.vendorUser.create({
                data: {
                    vendorId: newVendor.id,
                    name: '代表',
                    pinCode: '1234',
                    pinChanged: false
                }
            });
            imported++;
        }

        await logOperation(
            'VENDOR_IMPORT',
            'Access DB',
            `${imported}件インポート、${skipped}件スキップ（既存）`
        );

        revalidatePath('/admin/vendors');
        return {
            success: true,
            imported,
            skipped,
            message: `${imported}件の業者をインポートしました（${skipped}件は既存のためスキップ）`
        };
    } catch (error) {
        console.error('Import vendors error:', error);
        return { success: false, message: 'インポート中にエラーが発生しました' };
    }
}

// Product Attribute Actions (For Autocomplete)
export async function getUniqueProductAttributes() {
    // We want unique categories, subCategories, suppliers
    // Prisma Distinct is useful here
    const categories = await prisma.product.findMany({
        select: { category: true },
        distinct: ['category'],
        orderBy: { category: 'asc' }
    });
    const subCategories = await prisma.product.findMany({
        select: { subCategory: true },
        where: { subCategory: { not: null } },
        distinct: ['subCategory'],
        orderBy: { subCategory: 'asc' }
    });
    const suppliers = await prisma.product.findMany({
        select: { supplier: true },
        where: { supplier: { not: null } },
        distinct: ['supplier'],
        orderBy: { supplier: 'asc' }
    });

    // カテゴリ別掛率ルールも取得
    const pricingRules = await prisma.categoryPricingRule.findMany();
    const pricingRuleMap: Record<string, { markupRateA: number; markupRateB: number }> = {};
    for (const rule of pricingRules) {
        pricingRuleMap[rule.category] = { markupRateA: rule.markupRateA, markupRateB: rule.markupRateB };
    }

    return {
        categories: categories.map(c => c.category),
        subCategories: subCategories.map(c => c.subCategory).filter(Boolean) as string[],
        suppliers: suppliers.map(c => c.supplier).filter(Boolean) as string[],
        pricingRules: pricingRuleMap,
    };
}

export async function upsertVendor(data: { id?: number; name: string; email?: string | null; accessCompanyName?: string | null; showPriceInEmail?: boolean; priceTier?: string; deliveryLocationId?: number | null }) {
    if (data.id) {
        // Update
        await prisma.vendor.update({
            where: { id: data.id },
            data: {
                name: data.name,
                email: data.email,
                accessCompanyName: data.accessCompanyName,
                showPriceInEmail: data.showPriceInEmail ?? true,
                priceTier: data.priceTier ?? "A",
                deliveryLocationId: data.deliveryLocationId ?? null,
            },
        });
        await logOperation("VENDOR_UPDATE", `業者: ${data.name} (ID: ${data.id})`, `プロフィール更新 Access連携: ${data.accessCompanyName || 'なし'}, 価格帯: ${data.priceTier || 'A'}, 納品先: ${data.deliveryLocationId || 'なし'}`);
    } else {
        // Create
        const newVendor = await prisma.vendor.create({
            data: {
                name: data.name,
                email: data.email,
                accessCompanyName: data.accessCompanyName,
                showPriceInEmail: data.showPriceInEmail ?? true,
                priceTier: data.priceTier ?? "A",
                deliveryLocationId: data.deliveryLocationId ?? null,
                isActive: true,
            },
        });

        // デフォルト担当者「代表」を作成
        await prisma.vendorUser.create({
            data: {
                vendorId: newVendor.id,
                name: '代表',
                pinCode: '1234',
                pinChanged: false
            }
        });

        await logOperation("VENDOR_CREATE", `業者: ${data.name}`, `新規作成 Access連携: ${data.accessCompanyName || 'なし'}`);
    }
    revalidatePath('/admin/vendors');
}

export async function deleteVendor(id: number) {
    // Check if vendor has transactions
    const transactionCount = await prisma.transaction.count({
        where: { vendorId: id },
    });

    if (transactionCount > 0) {
        throw new Error('取引履歴がある業者は削除できません');
    }

    const vendor = await prisma.vendor.findUnique({ where: { id } });
    await prisma.vendor.delete({
        where: { id },
    });

    await logOperation("VENDOR_DELETE", `業者: ${vendor?.name || id}`, `業者を削除`);
    revalidatePath('/admin/vendors');
}

export async function verifyPin(vendorId: string | number, vendorUserId: string | number, pin: string) {
    const start = performance.now();
    const vendorUser = await prisma.vendorUser.findUnique({
        where: { id: Number(vendorUserId) },
        include: { vendor: true }
    });
    const dbTime = performance.now();
    console.log(`[verifyPin] DB Query took ${dbTime - start}ms`);

    if (!vendorUser) {
        await logOperation("KIOSK_LOGIN_FAILED", `UserId: ${vendorUserId}`, "担当者が存在しません");
        return { success: false, message: '担当者が存在しません' };
    }

    if (vendorUser.vendorId !== Number(vendorId)) {
        await logOperation("KIOSK_LOGIN_FAILED", vendorUser.name, "所属業者の不一致");
        return { success: false, message: '担当者の所属が一致しません' };
    }

    if (vendorUser.pinCode !== pin) {
        await logOperation("KIOSK_LOGIN_FAILED", vendorUser.name, "PIN不一致");
        return { success: false, message: 'PINコードが正しくありません' };
    }

    const totalTime = performance.now() - start;
    console.log(`[verifyPin] Total execution took ${totalTime}ms`);

    if (totalTime > 1000) {
        await logOperation("PERFORMANCE_WARNING", `ログイン: ${vendorUser.name}`, `処理遅延: ${Math.round(totalTime)}ms (DB: ${Math.round(dbTime - start)}ms)`);
    }

    // LOGINログはクライアント側でセッションID付きで記録

    return {
        success: true,
        vendor: vendorUser.vendor,
        vendorUser,
        pinChanged: vendorUser.pinChanged
    };
}

export async function verifyVendorPin(vendorId: string | number, pin: string) {
    const start = performance.now();
    // 1. Direct DB Query
    const matchedUser = await prisma.vendorUser.findFirst({
        where: {
            vendorId: Number(vendorId),
            pinCode: pin
        },
        include: { vendor: true }
    });

    const dbTime = performance.now();
    console.log(`[verifyVendorPin] DB Query took ${dbTime - start}ms`);

    if (!matchedUser) {
        // 詳細なエラー理由（PIN間違いか、ユーザーが存在しないか）を区別したければ
        // 別途クエリが必要だが、セキュリティ上は「違います」だけで良い。
        // デバッグ用にログには残す。
        logOperation("KIOSK_LOGIN_FAILED", `VendorId: ${vendorId}`, "PIN不一致または未登録");
        return { success: false, message: 'PINコードが正しくありません' };
    }

    // 3. Success（LOGINログはクライアント側でセッションID付きで記録）
    return {
        success: true,
        vendor: matchedUser.vendor,
        vendorUser: matchedUser,
        pinChanged: matchedUser.pinChanged
    };
}

export async function loginByPin(pin: string) {
    const vendorUser = await prisma.vendorUser.findFirst({
        where: { pinCode: pin },
        include: { vendor: true }
    });

    if (!vendorUser) {
        return { success: false, message: 'PINコードが無効です' };
    }

    if (!vendorUser.vendor.isActive) {
        return { success: false, message: 'この業者は現在無効です' };
    }

    return {
        success: true,
        vendor: vendorUser.vendor,
        vendorUser,
        pinChanged: vendorUser.pinChanged
    };
}

// PINコードを変更（担当者用）
export async function changePin(vendorUserId: number, newPin: string) {
    // 4桁の数字のみ許可
    if (!/^\d{4}$/.test(newPin)) {
        return { success: false, message: 'PINは4桁の数字で入力してください' };
    }

    // 初期PIN（1234）は設定不可
    if (newPin === '1234') {
        return { success: false, message: '初期PIN(1234)は使用できません' };
    }

    // 重複チェック（全担当者で一意）
    const existing = await prisma.vendorUser.findFirst({
        where: { pinCode: newPin },
    });
    if (existing && existing.id !== vendorUserId) {
        return { success: false, message: 'このPINは既に使用されています' };
    }

    const vendorUser = await prisma.vendorUser.update({
        where: { id: vendorUserId },
        data: { pinCode: newPin, pinChanged: true },
        include: { vendor: true }
    });

    await logOperation("VENDOR_USER_PIN_CHANGE", `${vendorUser.vendor.name} / ${vendorUser.name}`, `PIN変更`);
    return { success: true, vendorUser };
}

// PINコードをリセット（管理者用）
export async function resetPin(vendorUserId: number) {
    const vendorUser = await prisma.vendorUser.update({
        where: { id: vendorUserId },
        data: { pinCode: '1234', pinChanged: false },
        include: { vendor: true }
    });

    await logOperation("VENDOR_USER_PIN_RESET", `${vendorUser.vendor.name} / ${vendorUser.name}`, `PINを1234にリセット`);
    revalidatePath('/admin/vendors');
    return { success: true };
}

// 担当者一覧を取得
export async function getVendorUsers(vendorId: number) {
    return await prisma.vendorUser.findMany({
        where: { vendorId },
        orderBy: { name: 'asc' }
    });
}

// 担当者を作成
export async function createVendorUser(vendorId: number, name: string, pin?: string) {
    const start = performance.now();
    // 名前の重複チェック
    const existing = await prisma.vendorUser.findFirst({
        where: { vendorId, name }
    });
    console.log(`[createVendorUser] Name check took ${performance.now() - start}ms`);
    if (existing) {
        return { success: false, message: 'この名前は既に登録されています' };
    }

    // PINが指定されていれば使用、なければ初期PIN
    const pinCode = pin || '1234';
    const pinChanged = !!pin && pin !== '1234';

    const createStart = performance.now();
    const vendorUser = await prisma.vendorUser.create({
        data: {
            name,
            vendorId,
            pinCode,
            pinChanged
        }
    });
    console.log(`[createVendorUser] Creation took ${performance.now() - createStart}ms`);

    const vendor = await prisma.vendor.findUnique({ where: { id: vendorId } });
    await logOperation("VENDOR_USER_CREATE", `${vendor?.name} / ${name}`, `担当者を追加${pin ? '（自己登録）' : ''}`);
    revalidatePath('/admin/vendors');
    return { success: true, vendorUser };
}

// 担当者を削除
export async function deleteVendorUser(vendorUserId: number) {
    const vendorUser = await prisma.vendorUser.findUnique({
        where: { id: vendorUserId },
        include: { vendor: true }
    });

    if (!vendorUser) {
        throw new Error('担当者が見つかりません');
    }

    // 最後の担当者は削除できない
    const count = await prisma.vendorUser.count({
        where: { vendorId: vendorUser.vendorId }
    });
    if (count <= 1) {
        throw new Error('最後の担当者は削除できません');
    }

    await prisma.vendorUser.delete({ where: { id: vendorUserId } });
    await logOperation("VENDOR_USER_DELETE", `${vendorUser.vendor.name} / ${vendorUser.name}`, `担当者を削除`);
    revalidatePath('/admin/vendors');
}

// QRトークンでログイン
export async function loginByQrToken(qrToken: string) {
    if (!qrToken) {
        return { success: false, message: 'QRコードが無効です' };
    }


    const vendor = await prisma.vendor.findUnique({
        where: { qrToken },
    });

    if (!vendor) {
        return { success: false, message: 'QRコードが無効です' };
    }

    return { success: true, vendor };
}

// QRトークンを生成・更新
export async function generateQrToken(vendorId: number) {
    // ランダムなトークンを生成 (16文字の英数字)
    const token = `VND${vendorId}-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    const vendor = await prisma.vendor.update({
        where: { id: vendorId },
        data: { qrToken: token },
    });

    await logOperation("VENDOR_QR_GENERATE", `Vendor: ${vendor.name}`, `Generated QR token`);
    revalidatePath('/admin/vendors');

    return { success: true, qrToken: token };
}




// Product Actions
export async function getProduct(id: number) {
    return await prisma.product.findUnique({
        where: { id },
    });
}

export async function getProducts() {
    return await prisma.product.findMany({
        orderBy: [
            { usageCount: 'desc' },
            { code: 'asc' }
        ],
    });
}

// 在庫確認フラグをトグル（商品一覧からのインライン操作用）
export async function toggleRequireStockCheck(productId: number, value: boolean) {
    "use server";
    await prisma.product.update({
        where: { id: productId },
        data: { requireStockCheck: value },
    });
    revalidatePath('/admin/products');
    return { success: true };
}

// Special sort for Kiosk Shop
// 1. In Stock (Stock > 0)
// 2. Popularity (Usage Count)
// 3. Code (Tie-breaker)
export async function getShopProducts() {
    const products = await prisma.product.findMany();

    return products.sort((a, b) => {
        // Priority 1: Stock Availability (In Stock comes first)
        const aInStock = a.stock > 0;
        const bInStock = b.stock > 0;
        if (aInStock && !bInStock) return -1;
        if (!aInStock && bInStock) return 1;

        // Priority 2: Usage Count (Higher usage comes first)
        if (a.usageCount !== b.usageCount) {
            return b.usageCount - a.usageCount; // Desc
        }

        // Priority 3: Code (Alphabetical)
        const userCodeA = a.code || "";
        const userCodeB = b.code || "";
        return userCodeA.localeCompare(userCodeB);
    });
}

const normalizeCode = (code: string) => {
    if (!code) return "";
    return code
        .replace(/[！-～]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xfee0)) // Full-width to Half-width
        .replace(/[-\s]/g, "") // Remove hyphens and spaces
        .toUpperCase();
};

// =========================================
// カテゴリ別掛率管理
// =========================================

// 掛率ルール一覧取得
export async function getCategoryPricingRules() {
    return prisma.categoryPricingRule.findMany({
        orderBy: { category: 'asc' },
    });
}

// 掛率ルール更新（管理画面から）
export async function upsertCategoryPricingRule(category: string, markupRateA: number, markupRateB: number) {
    if (markupRateA <= 1.0) throw new Error(`掛率A(${markupRateA})は1.0より大きくしてください`);
    if (markupRateB <= 1.0) throw new Error(`掛率B(${markupRateB})は1.0より大きくしてください`);
    if (markupRateB >= markupRateA) throw new Error(`掛率B(${markupRateB})は掛率A(${markupRateA})より小さくしてください`);

    const rule = await prisma.categoryPricingRule.upsert({
        where: { category },
        update: { markupRateA, markupRateB },
        create: { category, markupRateA, markupRateB },
    });

    await logOperation("PRICING_RULE_UPDATE", `カテゴリ: ${category}`, `掛率A: ${markupRateA}, 掛率B: ${markupRateB}`);
    revalidatePath('/admin/pricing');
    return rule;
}

// カテゴリの掛率でpriceA/Bを自動計算
function calculatePricesByMarkup(cost: number, markupRateA: number, markupRateB: number) {
    return {
        priceA: Math.ceil(cost * markupRateA),
        priceB: Math.ceil(cost * markupRateB),
    };
}

// 指定カテゴリの全AUTO商品の価格を再計算
export async function recalculateCategoryPrices(category: string) {
    const rule = await prisma.categoryPricingRule.findUnique({ where: { category } });
    if (!rule) throw new Error(`カテゴリ「${category}」の掛率ルールが見つかりません`);

    const products = await prisma.product.findMany({
        where: { category, priceMode: 'AUTO' },
    });

    let updated = 0;
    for (const p of products) {
        if (p.cost <= 0) continue; // costが0の商品はスキップ
        const { priceA, priceB } = calculatePricesByMarkup(p.cost, rule.markupRateA, rule.markupRateB);
        await prisma.product.update({
            where: { id: p.id },
            data: { priceA, priceB },
        });
        updated++;
    }

    await logOperation("PRICING_RECALCULATE", `カテゴリ: ${category}`, `${updated}件の価格を再計算 (A×${rule.markupRateA}, B×${rule.markupRateB})`);
    revalidatePath('/admin/products');
    revalidatePath('/admin/pricing');
    return { updated, total: products.length };
}

// 価格順序セーフガード: cost < priceB < priceA
function validatePriceOrder(cost: number, priceB: number, priceA: number, priceMode: string = 'AUTO'): string | null {
    if (cost > 0 && priceA > 0 && priceA <= cost) {
        return `売価A(${priceA})が仕入値(${cost})以下です`;
    }
    if (cost > 0 && priceB > 0 && priceB <= cost) {
        return `売価B(${priceB})が仕入値(${cost})以下です`;
    }
    if (priceMode === 'MANUAL') {
        // 手動設定: 同額もNG（AはBより高くする必要）
        if (priceA > 0 && priceB > 0 && priceA <= priceB) {
            return `売価A(${priceA})が売価B(${priceB})以下です（手動設定時はAはBより高くしてください）`;
        }
    } else {
        // 自動計算: 同額はOK（Math.ceilで同額になる場合がある）
        if (priceA > 0 && priceB > 0 && priceA < priceB) {
            return `売価A(${priceA})が売価B(${priceB})より小さいです（AはB以上にしてください）`;
        }
    }
    return null;
}

// 価格レポート取得（管理画面用）
export async function getPricingReport() {
    const products = await prisma.product.findMany({
        select: {
            id: true, code: true, name: true,
            category: true, priceA: true, priceB: true, priceC: true,
            cost: true, priceMode: true,
        },
        orderBy: [{ category: 'asc' }, { code: 'asc' }],
    });
    const rules = await prisma.categoryPricingRule.findMany();
    const ruleMap = new Map(rules.map(r => [r.category, r]));

    return products.map(p => {
        const rule = ruleMap.get(p.category);
        const expectedA = rule && p.cost > 0 ? Math.ceil(p.cost * rule.markupRateA) : null;
        const expectedB = rule && p.cost > 0 ? Math.ceil(p.cost * rule.markupRateB) : null;
        const violation = validatePriceOrder(p.cost, p.priceB, p.priceA);
        return {
            ...p,
            markupRateA: rule?.markupRateA ?? null,
            markupRateB: rule?.markupRateB ?? null,
            expectedA,
            expectedB,
            diffA: expectedA !== null ? p.priceA - expectedA : null,
            diffB: expectedB !== null ? p.priceB - expectedB : null,
            isPriceAManual: expectedA !== null && p.priceA !== expectedA,
            isPriceBManual: expectedB !== null && p.priceB !== expectedB,
            violation,
        };
    });
}

// =========================================
// 商品のCRUD (掛率対応版)
// =========================================

export async function upsertProduct(data: {
    id?: number;
    code: string;
    name: string;
    category: string;
    subCategory?: string | null;
    productType?: string | null;
    priceA: number;
    priceB: number;
    priceC: number;
    minStock: number;
    cost: number;
    stock?: number;
    supplier?: string | null;
    color?: string | null;
    unit?: string;
    orderUnit?: number;
    manufacturer?: string | null;
    quantityPerBox?: number;
    pricePerBox?: number;
    priceMode?: string;
    requireStockCheck?: boolean;
    compatibleGroupId?: string | null;
}) {
    // priceMode自動判定: カテゴリ掛率と比較して一致しなければMANUAL
    let finalPriceA = data.priceA;
    let finalPriceB = data.priceB;
    let priceMode: string = 'AUTO';

    if (data.cost > 0) {
        const rule = await prisma.categoryPricingRule.findUnique({ where: { category: data.category } });
        if (rule) {
            const calc = calculatePricesByMarkup(data.cost, rule.markupRateA, rule.markupRateB);
            // 送信された価格が掛率計算値と一致するか判定
            const isAutoA = data.priceA === calc.priceA;
            const isAutoB = data.priceB === calc.priceB;
            if (!isAutoA || !isAutoB) {
                priceMode = 'MANUAL';
            }
        }
    }

    // セーフガード: cost < priceB < priceA
    const violation = validatePriceOrder(data.cost, finalPriceB, finalPriceA, priceMode);
    if (violation) throw new Error(violation);

    const normalizedCode = normalizeCode(data.code);

    if (data.id) {
        // Update
        const result = await prisma.$transaction(async (tx) => {
            const currentProduct = await tx.product.findUnique({ where: { id: data.id } });
            if (!currentProduct) throw new Error("Product not found");

            const updateData: any = {
                code: normalizedCode,
                name: data.name,
                category: data.category,
                subCategory: data.subCategory,
                productType: data.productType,
                priceA: finalPriceA,
                priceB: finalPriceB,
                priceC: data.priceC,
                minStock: data.minStock,
                supplier: data.supplier,
                color: data.color,
                unit: data.unit ?? "個",
                orderUnit: data.orderUnit ?? 1,
                manufacturer: data.manufacturer,
                quantityPerBox: data.quantityPerBox ?? 1,
                pricePerBox: data.pricePerBox ?? 0,
                priceMode,
                requireStockCheck: data.requireStockCheck ?? false,
                compatibleGroupId: data.compatibleGroupId ?? null,
            };

            // costが0より大きい場合のみ更新
            if (data.cost > 0) {
                updateData.cost = data.cost;
            }

            // Handle Stock Change & Logging
            if (data.stock !== undefined && data.stock !== currentProduct.stock) {
                const diff = data.stock - currentProduct.stock;
                updateData.stock = data.stock;

                await tx.inventoryLog.create({
                    data: {
                        productId: currentProduct.id,
                        type: 'INVENTORY_ADJUSTMENT',
                        quantity: diff,
                        reason: `Manual Edit (Stock: ${currentProduct.stock} -> ${data.stock})`,
                    }
                });
            }

            const updatedProduct = await tx.product.update({
                where: { id: data.id },
                data: updateData as any,
            });

            const logDetail = `PriceA: ${finalPriceA}, PriceB: ${finalPriceB}, Cost: ${data.cost > 0 ? data.cost : '(unchanged)'}, Mode: ${priceMode}`;
            return { product: updatedProduct, logDetail };
        });

        await logOperation("PRODUCT_UPDATE", `Product: ${normalizedCode}`, result.logDetail);
    } else {
        // Create
        const existing = await prisma.product.findUnique({ where: { code: normalizedCode } });
        if (existing) {
            throw new Error(`商品ID ${normalizedCode} は既に使用されています`);
        }

        await prisma.product.create({
            data: {
                code: normalizedCode,
                name: data.name,
                category: data.category,
                subCategory: data.subCategory,
                productType: data.productType,
                priceA: finalPriceA,
                priceB: finalPriceB,
                priceC: data.priceC,
                minStock: data.minStock,
                cost: data.cost,
                stock: data.stock ?? 0,
                supplier: data.supplier,
                color: data.color,
                unit: data.unit ?? "個",
                orderUnit: data.orderUnit ?? 1,
                manufacturer: data.manufacturer,
                quantityPerBox: data.quantityPerBox ?? 1,
                pricePerBox: data.pricePerBox ?? 0,
                priceMode,
                compatibleGroupId: data.compatibleGroupId ?? null,
            } as any,
        });
        await logOperation("PRODUCT_CREATE", `商品: ${normalizedCode}`, `新規商品を作成 (Mode: ${priceMode})`);
    }

    revalidatePath('/admin/products');
}




// Helper to check for active inventory session
export async function checkActiveInventory() {
    const activeInventory = await prisma.inventoryCount.findFirst({
        where: { status: 'IN_PROGRESS' },
    });
    return !!activeInventory;
}

export async function getImportDiff(products: any[]) {
    const diffs: any[] = [];

    // Normalize code helper
    // Display Normalization (Storage): Keep hyphens, remove spaces, half-width
    const normalizeCode = (code: string) => {
        if (!code) return "";
        return code.replace(/[！-～]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xfee0)).replace(/[\s]/g, "").toUpperCase();
    };

    // Strict Normalization (Duplication Check): Remove hyphens too
    const strictNormalizeCode = (code: string) => {
        return normalizeCode(code).replace(/-/g, "");
    };

    for (const p of products) {
        const displayCode = normalizeCode(p.code);
        const strictCode = strictNormalizeCode(p.code);

        let existing = null;

        if (p.id) {
            existing = await prisma.product.findUnique({ where: { id: p.id } });
        }
        if (!existing) {
            // Find by strict code (we need to fetch all candidates and check in memory OR trust that stored codes might vary)
            // Best approach: Find by displayCode first. If not found, try to find strictly? 
            // Prisma doesn't support custom transform in findUnique.
            // We'll iterate or use findFirst. But checking ALL products is slow.
            // Compromise: We search by displayCode (exact match).
            // The user wants: "Check for duplicates by removing hyphens". 
            // So if DB has "AP-200", and import is "AP200", it should match.
            // This requires scanning or maintaining a normalized column.
            // Without schema change: we can't efficiently find "AP-200" using "AP200" via DB query index.
            // However, we can try to find by `displayCode` first.
            existing = await prisma.product.findUnique({ where: { code: displayCode } });

            // If not found, we really should check strict equality to avoid "AP-200" and "AP200" co-existing.
            // But doing `findFirst` with a regex or raw query is complex here.
            // For now, let's trust that the User will use consistent formatting if they want to avoid dupes, 
            // OR we accept that "AP-200" and "AP200" might coexist if the system was loose before.
            // WAIT, user said: "Check if it's the same product by removing hyphens".
            // So we MUST check strictly.
            if (!existing) {
                // Fallback: Try to find un-hyphenated version if imported code has hyphens, or vice versa?
                // Checking if "AP200" exists when "AP-200" is imported:
                const allProducts = await prisma.product.findMany({ select: { id: true, code: true } });
                const match = allProducts.find(prod => strictNormalizeCode(prod.code) === strictCode);
                if (match) {
                    existing = await prisma.product.findUnique({ where: { id: match.id } });
                }
            }
        }

        // Calculate defaults for comparison (same logic as import)
        let priceA = p.priceA;
        let priceB = p.priceB;
        if ((priceA === 0 || !priceA) && p.cost > 0) priceA = Math.ceil(p.cost * 1.20);
        if ((priceB === 0 || !priceB) && p.cost > 0) priceB = Math.ceil(p.cost * 1.15);

        if (!existing) {
            diffs.push({ code: displayCode, name: p.name, type: 'NEW', changes: [] });
        } else {
            const changes = [];
            // 品番(code)の変更を検知
            if (existing.code !== displayCode) changes.push({ field: '品番', old: existing.code, new: displayCode });

            if (existing.name !== p.name) changes.push({ field: '商品名', old: existing.name, new: p.name });
            if (existing.category !== p.category) changes.push({ field: 'カテゴリ', old: existing.category, new: p.category });
            if (existing.subCategory !== (p.subCategory || "その他")) changes.push({ field: 'サブカテゴリ', old: existing.subCategory, new: p.subCategory || "その他" });
            if (existing.productType !== (p.productType || null)) changes.push({ field: '種類', old: existing.productType, new: p.productType });

            if (existing.priceA !== priceA) changes.push({ field: '売価A', old: existing.priceA, new: priceA });
            if (existing.priceB !== priceB) changes.push({ field: '売価B', old: existing.priceB, new: priceB });
            if (existing.priceC !== p.priceC) changes.push({ field: '売価C', old: existing.priceC, new: p.priceC });

            if (existing.cost !== p.cost) changes.push({ field: '原価', old: existing.cost, new: p.cost });
            if (existing.minStock !== (p.minStock || 0)) changes.push({ field: '最低在庫', old: existing.minStock, new: p.minStock || 0 });
            // Supplier, Manufacturer etc.
            if (existing.supplier !== (p.supplier || null)) changes.push({ field: '仕入先', old: existing.supplier, new: p.supplier });

            if (changes.length > 0) {
                diffs.push({ code: displayCode, name: existing.name, type: 'UPDATE', changes });
            } else {
                diffs.push({ code: displayCode, name: existing.name, type: 'UNCHANGED', changes: [] });
            }
        }
    }
    return diffs;
}

export async function importProducts(products: {
    id?: number;
    code: string;
    name: string;
    category: string;
    subCategory: string | null;
    productType?: string | null; // Added
    priceA: number;
    priceB: number;
    priceC: number;
    minStock: number;
    cost: number;
    supplier?: string | null;
    color?: string | null;
    unit?: string | null;
    manufacturer?: string | null;
    quantityPerBox?: number;
    pricePerBox?: number;
    orderUnit?: number;
}[]) {
    // 0. Check for active inventory
    if (await checkActiveInventory()) {
        return { success: false, message: '現在棚卸中のため、商品インポートは利用できません' };
    }

    try {
        // 1. Validation Phase
        const errorDetails: { line: number; message: string; type: 'REQUIRED' | 'PRICE' }[] = [];

        products.forEach((p, index) => {
            const line = index + 1;
            // Required check
            if (!p.code) errorDetails.push({ line, type: 'REQUIRED', message: `${line}行目: 品番(code)がありません` });
            if (!p.name) errorDetails.push({ line, type: 'REQUIRED', message: `${line}行目: 商品名(name)がありません` });
            if (!p.category) errorDetails.push({ line, type: 'REQUIRED', message: `${line}行目: カテゴリー大(category)がありません` });
            // subCategory is optional for import, but we will default to "その他" if empty
            // if (!p.subCategory) errorDetails.push({ line, type: 'REQUIRED', message: `${line}行目: カテゴリー中(subCategory)がありません` });

            // Cost validation (Skip if cost is 0, as it might be TBD)
            if (p.cost > 0) {
                if (p.priceA <= p.cost) errorDetails.push({ line, type: 'PRICE', message: `${line}行目: 売価A(${p.priceA})が原価(${p.cost})以下です。売価は原価より高く設定してください。` });
                if (p.priceB <= p.cost) errorDetails.push({ line, type: 'PRICE', message: `${line}行目: 売価B(${p.priceB})が原価(${p.cost})以下です。売価は原価より高く設定してください。` });
                if (p.priceC > 0 && p.priceC <= p.cost) errorDetails.push({ line, type: 'PRICE', message: `${line}行目: 売価C(${p.priceC})が原価(${p.cost})以下です。売価は原価より高く設定してください。` });
            }
        });

        if (errorDetails.length > 0) {
            // Error Message Construction
            let finalMessage = "";
            const THRESHOLD = 10; // Increased threshold

            if (errorDetails.length <= THRESHOLD) {
                // Few errors: Show detailed list
                finalMessage = "バリデーションエラー:\n" + errorDetails.map(e => e.message).join('\n');
            } else {
                // Many errors: Show summary + first 5 errors
                const requiredCount = errorDetails.filter(e => e.type === 'REQUIRED').length;
                const priceCount = errorDetails.filter(e => e.type === 'PRICE').length;
                const sampleErrors = errorDetails.slice(0, 5).map(e => `・${e.message}`).join('\n');

                finalMessage = `インポートエラー (合計 ${errorDetails.length}件)\n` +
                    `・必須項目未入力: ${requiredCount}件\n` +
                    `・価格設定エラー(原価割れ等): ${priceCount}件\n\n` +
                    `【エラー詳細（最初の5件）】\n` +
                    sampleErrors + `\n\n` +
                    `その他 ${errorDetails.length - 5} 件のエラーがあります。データの確認をお願いします。`;
            }

            return { success: false, message: finalMessage };
        }

        // Display Normalization (Storage): Keep hyphens, remove spaces, half-width
        const normalizeCode = (code: string) => {
            if (!code) return "";
            return code.replace(/[！-～]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xfee0)).replace(/[\s]/g, "").toUpperCase();
        };

        // Strict Normalization (Duplication Check): Remove hyphens too
        const strictNormalizeCode = (code: string) => {
            return normalizeCode(code).replace(/-/g, "");
        };

        // 2. Execution Phase
        // Pre-fetch all product codes for strict checking (Optimization: could be heavy if thousands of products, but safer)
        const allProductsSnapshot = await prisma.product.findMany({ select: { id: true, code: true } });

        await prisma.$transaction(async (tx) => {
            for (const p of products) {
                const displayCode = normalizeCode(p.code);
                const strictCode = strictNormalizeCode(p.code);

                // Try to find by ID first
                let existing = null;
                if (p.id) {
                    existing = await tx.product.findUnique({ where: { id: p.id } });
                }

                if (!existing) {
                    // strict check against snapshot to find "AP-200" vs "AP200" match
                    const match = allProductsSnapshot.find(prod => strictNormalizeCode(prod.code) === strictCode);
                    if (match) {
                        existing = await tx.product.findUnique({ where: { id: match.id } });
                    }
                }

                if (existing) {
                    await tx.product.update({
                        where: { id: existing.id }, // Update by ID
                        data: {
                            code: displayCode, // Update code if changed
                            name: p.name,
                            category: p.category,
                            subCategory: p.subCategory || "その他",
                            productType: p.productType || null,
                            priceA: p.priceA,
                            priceB: p.priceB,
                            priceC: p.priceC,
                            minStock: p.minStock,
                            cost: p.cost,
                            supplier: p.supplier,
                            color: p.color,
                            // @ts-ignore
                            unit: p.unit ?? existing.unit,
                            // @ts-ignore
                            orderUnit: p.orderUnit ?? existing.orderUnit,
                            // @ts-ignore
                            manufacturer: p.manufacturer ?? existing.manufacturer,
                            // @ts-ignore
                            quantityPerBox: p.quantityPerBox ?? existing.quantityPerBox,
                            // @ts-ignore
                            pricePerBox: p.pricePerBox ?? existing.pricePerBox,
                        } as any,
                    });
                } else {
                    await tx.product.create({
                        data: {
                            code: displayCode,
                            name: p.name,
                            category: p.category,
                            subCategory: p.subCategory || "その他",
                            productType: p.productType || null,
                            priceA: p.priceA,
                            priceB: p.priceB,
                            priceC: p.priceC,
                            minStock: p.minStock,
                            stock: 0,
                            cost: p.cost,
                            supplier: p.supplier,
                            color: p.color,
                            unit: p.unit ?? "個",
                            orderUnit: p.orderUnit ?? 1,
                            manufacturer: p.manufacturer,
                            quantityPerBox: p.quantityPerBox ?? 1,
                            pricePerBox: p.pricePerBox ?? 0,
                        } as any,
                    });
                }
            }
        });

        await logOperation("IMPORT", "一括インポート", `${products.length}件の商品をインポート/更新`);
        revalidatePath('/admin/products');
        return { success: true, count: products.length };
    } catch (error) {
        console.error("Import Error:", error);
        return { success: false, message: error instanceof Error ? error.message : 'インポート中にエラーが発生しました' };
    }
}

export async function deleteProduct(id: number) {
    // Check for transactions or logs
    const transactionCount = await prisma.transaction.count({
        where: { items: { contains: `"productId":${id}` } },
    });
    // Ideally we should also check InventoryLog
    if (transactionCount > 0) {
        throw new Error('取引履歴がある商品は削除できません');
    }

    const product = await prisma.product.findUnique({ where: { id } });
    await prisma.product.delete({
        where: { id },
    });

    await logOperation("PRODUCT_DELETE", `商品: ${product?.code || id}`, `${product?.name} を削除`);
    revalidatePath('/admin/products');
}

/**
 * @deprecated スポット棚卸（createSpotInventory）に置き換えられました。
 * UIからの呼び出しは削除済み。テスト互換性のため関数は残しています。
 */
export async function adjustStock(productId: number, type: string, quantity: number, reason: string) {
    // Transactional update
    await prisma.$transaction(async (tx) => {
        // OUT（出庫）の場合は在庫チェック
        if (type === 'OUT') {
            const product = await tx.product.findUnique({ where: { id: productId } });
            if (!product) throw new Error(`商品ID ${productId} が見つかりません`);
            if (product.stock < quantity) {
                throw new Error(`在庫不足: 現在 ${product.stock}個、出庫 ${quantity}個は不可`);
            }
        }

        // 1. Create Log
        await tx.inventoryLog.create({
            data: {
                productId,
                type,
                quantity,
                reason,
            },
        });

        // 2. Update Product Stock（IN=加算、OUT=減算）
        const delta = type === 'OUT' ? -quantity : quantity;
        await tx.product.update({
            where: { id: productId },
            data: {
                stock: {
                    increment: delta,
                },
            },
        });
    });

    // 管理画面の操作ログにも記録
    const product = await prisma.product.findUnique({ where: { id: productId } });
    const label = type === 'OUT' ? '出庫' : type === 'IN' ? '入庫' : type;
    await logOperation(
        "STOCK_ADJUST",
        `${product?.name || `商品#${productId}`}`,
        `${label} ${quantity}個 理由: ${reason}`
    );
    revalidatePath('/admin/products');
}

// Dashboard Actions
export async function getTransactions(limit = 100, filters?: {
    vendorName?: string;
    dateFrom?: string;
    dateTo?: string;
    textSearch?: string;
}) {
    const where: any = {};

    if (filters?.vendorName) {
        where.vendor = { name: { contains: filters.vendorName } };
    }

    if (filters?.dateFrom || filters?.dateTo) {
        where.date = {};
        if (filters?.dateFrom) {
            where.date.gte = new Date(filters.dateFrom);
        }
        if (filters?.dateTo) {
            const to = new Date(filters.dateTo);
            to.setHours(23, 59, 59, 999);
            where.date.lte = to;
        }
    }

    if (filters?.textSearch) {
        // items JSONに商品名が含まれるかサーバーサイドで検索
        where.items = { contains: filters.textSearch };
    }

    const transactions = await prisma.transaction.findMany({
        where,
        take: limit,
        orderBy: { date: 'desc' },
        include: {
            vendor: true,
            vendorUser: true,
        },
    });
    return transactions;
}

export async function getRecentTransactions(limit = 10) {
    return getTransactions(limit);
}

export async function getDashboardStats() {
    const totalTransactions = await prisma.transaction.count();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTransactions = await prisma.transaction.count({
        where: {
            date: {
                gte: today,
            },
        },
    });

    const totalStock = await prisma.product.aggregate({
        _sum: {
            stock: true
        }
    });

    return {
        totalTransactions,
        todayTransactions,
        totalStock: totalStock._sum.stock || 0
    };
}

export async function getAnalysisData() {
    const products = await prisma.product.findMany();

    let totalCost = 0;
    let totalSalesValue = 0;
    const lowMarginProducts = [];

    for (const p of products) {
        totalCost += p.cost * p.stock;
        totalSalesValue += p.priceA * p.stock;

        // Check margin
        const margin = p.priceA > 0 ? ((p.priceA - p.cost) / p.priceA) * 100 : 0;
        if (margin < 10) { // Threshold: 10%
            lowMarginProducts.push({ ...p, margin });
        }
    }

    return {
        totalCost,
        totalSalesValue,
        potentialProfit: totalSalesValue - totalCost,
        lowMarginProducts: lowMarginProducts.sort((a, b) => a.margin - b.margin), // Ascending margin
    };
}

// Import email utility
import { sendTransactionEmail } from './mail';

export async function createTransaction(
    vendorId: number,
    vendorUserId: number | null,  // 担当者ID追加
    items: { productId: number; quantity: number; price: number; name: string; isManual?: boolean; code?: string; isBox?: boolean; quantityPerBox?: number; unit?: string }[],
    totalAmountParam?: number,
    isProxyInput: boolean = false,
    transactionDate?: Date  // 代理入力用：引取日を指定
) {
    // 0. Check for active inventory
    if (await checkActiveInventory()) {
        throw new Error('現在棚卸中のため、決済処理は利用できません');
    }

    // 1. Calculate total
    const totalAmount = totalAmountParam ?? items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const hasUnregisteredItems = items.some((item) => item.isManual);

    // Log proxy input operation
    if (isProxyInput) {
        const dateStr = transactionDate ? transactionDate.toLocaleDateString('ja-JP') : '本日';
        await logOperation('PROXY_INPUT', `代理入力: 業者ID=${vendorId}, 商品数=${items.length}, 合計=¥${totalAmount}, 引取日=${dateStr}`);
    }

    // 2. Transactional update (Create Transaction + Decrease Stock + Create Log)
    try {
        const transactionResult = await prisma.$transaction(async (tx) => {
            // First, process items to fetch codes and check stock
            // This ensures 'items' has 'code' populated BEFORE we stringify it for the transaction record
            for (const item of items) {
                if (item.isManual) continue;

                const product = await tx.product.findUnique({ where: { id: item.productId } });
                if (!product || product.stock < item.quantity) {
                    throw new Error(`商品ID ${item.productId} の在庫が不足しています`);
                }
                // Add code and unit to item for storage
                item.code = product.code;
                item.unit = product.unit; // Store unit snapshot
            }

            // Create Transaction Record (Now items contains codes)
            const transaction = await tx.transaction.create({
                data: {
                    vendorId,
                    vendorUserId,  // 担当者ID
                    items: JSON.stringify(items), // Store detailed items as JSON
                    totalAmount,
                    hasUnregisteredItems, // Set flag
                    date: transactionDate ?? new Date(),  // 指定された日付または現在日時
                    isProxyInput,  // 代理入力フラグ
                },
            });

            // Update Stock for each item and create logs
            for (const item of items) {
                // Skip stock management for manual items
                if (item.isManual) continue;

                // Calculate actual stock deduction (Units)
                const quantityToDeduct = (item.isBox && item.quantityPerBox)
                    ? item.quantity * item.quantityPerBox
                    : item.quantity;

                // Decrease Stock
                await tx.product.update({
                    where: { id: item.productId },
                    data: {
                        stock: { decrement: quantityToDeduct },
                        usageCount: { increment: quantityToDeduct }
                    },
                });

                // Create Inventory Log
                await tx.inventoryLog.create({
                    data: {
                        productId: item.productId,
                        type: '出庫',
                        quantity: -quantityToDeduct, // Negative for outflow
                        reason: `Transaction #${transaction.id}${item.isBox ? ' (Box)' : ''}`,
                    },
                });

                // エアコン連携: 紐づきエアコン商品がある場合、エアコン在庫も減算+ログ作成
                const productWithAircon = await tx.product.findUnique({
                    where: { id: item.productId },
                    select: { airconProductId: true, airconProduct: { select: { id: true, code: true, stock: true } } }
                });
                if (productWithAircon?.airconProductId && productWithAircon.airconProduct) {
                    const aircon = productWithAircon.airconProduct;
                    // エアコン在庫を減算
                    await tx.airconProduct.update({
                        where: { id: aircon.id },
                        data: { stock: { decrement: quantityToDeduct } },
                    });
                    // エアコンログを作成（買取記録 — 日時はトランザクションと統一）
                    await tx.airConditionerLog.create({
                        data: {
                            managementNo: null,
                            modelNumber: aircon.code,
                            vendorId: vendorId,
                            vendorUserId: vendorUserId,
                            airconProductId: aircon.id,
                            type: 'PURCHASE',
                            note: `材料買取 TX#${transaction.id}`,
                            createdAt: transaction.date, // トランザクション日時と統一
                        },
                    });
                    // 材料在庫をエアコン在庫と同期
                    const updatedAircon = await tx.airconProduct.findUnique({ where: { id: aircon.id }, select: { stock: true } });
                    if (updatedAircon) {
                        await tx.product.update({
                            where: { id: item.productId },
                            data: { stock: updatedAircon.stock },
                        });
                    }
                }
            }

            // 処理後の在庫を取得（在庫確認ダイアログ用）
            const updatedProducts = await Promise.all(
                items.filter(i => !i.isManual).map(async (item) => {
                    const p = await tx.product.findUnique({
                        where: { id: item.productId },
                        select: { id: true, stock: true, name: true, code: true, unit: true, requireStockCheck: true },
                    });
                    return p;
                })
            );

            return { transaction, updatedProducts: updatedProducts.filter(Boolean) };
        });

        revalidatePath('/admin/products');
        revalidatePath('/admin/transactions');
        revalidatePath('/shop'); // Revalidate shop to update stock display

        // 3. Send Email Notification (Async, don't block response)
        // Fetch vendor to get email
        const vendor = await prisma.vendor.findUnique({ where: { id: vendorId } });
        if (vendor && vendor.email) {
            console.log(`Attempting to send email to ${vendor.email}`);
            // We don't await this to ensure fast response to UI, or we can await inside a try-catch to log errors but not fail transaction
            // Ideally use a queue, but for now simple async invocation
            sendTransactionEmail(vendor.email, vendor.name, items.map(i => ({ ...i, id: String(i.productId) })), totalAmount)
                .then(() => console.log("Email promise resolved"))
                .catch(err => console.error("Failed to send email:", err));
        } else {
            console.log("No email address found for vendor, skipping email.");
        }

        console.log("Transaction created successfully, returning success.");
        // 在庫確認用に処理後の在庫情報を返す（requireStockCheck=trueの商品のみ）
        const stockInfo = transactionResult.updatedProducts
            .filter((p: any) => p.requireStockCheck)
            .map((p: any) => ({
                productId: p.id,
                name: p.name,
                code: p.code,
                expectedStock: p.stock,
                unit: p.unit,
            }));
        return { success: true, stockInfo };
    } catch (error) {
        console.error("Transaction Error:", error);
        return { success: false, message: error instanceof Error ? error.message : '取引処理中にエラーが発生しました' };
    }
}

// Reconciliation Action
export async function reconcileTransactionItem(transactionId: number, manualItemName: string, targetProductId: number) {
    try {
        await prisma.$transaction(async (tx) => {
            // 1. Get Transaction
            const transaction = await tx.transaction.findUnique({
                where: { id: transactionId },
            });
            if (!transaction) throw new Error("取引データが見つかりません");

            // 月次締めチェック
            const closed = await checkTransactionMonthClosed(transaction.date);
            if (closed) throw new Error("この取引の月は締め済みのため編集できません");

            const items = JSON.parse(transaction.items) as any[];
            let updated = false;
            let quantityToDeduct = 0;

            // 2. Find and Replace Item (First pass to flag and get quantity)
            let foundIndex = -1;
            for (let i = 0; i < items.length; i++) {
                if (items[i].isManual && items[i].name === manualItemName) {
                    foundIndex = i;
                    updated = true;
                    quantityToDeduct = items[i].quantity;
                    break;
                }
            }

            if (!updated) throw new Error("対象の手入力商品が見つかりません");

            // 3. Fetch Target Product
            const product = await tx.product.findUnique({ where: { id: targetProductId } });
            if (!product) throw new Error("紐付け先の商品が見つかりません");

            // 4. Update the item details
            items[foundIndex] = {
                ...items[foundIndex],
                productId: targetProductId,
                name: product.name,
                price: product.priceA,
                isManual: false
            };

            // 5. Recalculate Total
            const newTotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
            const hasUnregistered = items.some((item) => item.isManual);

            // 6. Update Transaction
            await tx.transaction.update({
                where: { id: transactionId },
                data: {
                    items: JSON.stringify(items),
                    totalAmount: newTotal,
                    hasUnregisteredItems: hasUnregistered,
                }
            });

            // 7. Deduct Stock (Retroactive)
            await tx.product.update({
                where: { id: targetProductId },
                data: { stock: { decrement: quantityToDeduct } }
            });

            // 8. Log
            await tx.inventoryLog.create({
                data: {
                    productId: targetProductId,
                    type: '出庫',
                    quantity: -quantityToDeduct,
                    reason: `Reconciliation Tx #${transactionId}`,
                }
            });
        });

        revalidatePath('/admin/transactions');
        revalidatePath('/admin/products');
        return { success: true };
    } catch (error) {
        console.error("Reconciliation Error:", error);
        return { success: false, message: error instanceof Error ? error.message : '処理に失敗しました' };
    }
}

// Return transaction (Restore stock)
export async function returnTransaction(transactionId: number) {
    // 0. Active Inventory Check
    if (await checkActiveInventory()) {
        return { success: false, message: '現在棚卸中のため、戻し処理は利用できません' };
    }

    try {
        await prisma.$transaction(async (tx) => {
            // 1. Fetch Transaction (with vendor info for logging)
            const transaction = await tx.transaction.findUnique({
                where: { id: transactionId },
                include: { vendor: true, vendorUser: true }
            });

            if (!transaction) throw new Error("取引が見つかりません");

            // 月次締めチェック
            const closed = await checkTransactionMonthClosed(transaction.date);
            if (closed) throw new Error("この取引の月は締め済みのため返品できません");
            if (transaction.isReturned) throw new Error("既に戻し処理済みです");

            // 元の明細を保存（ログ用）
            const originalItems = transaction.items;

            // 2. Parse Items
            const items = JSON.parse(transaction.items) as { productId: number; quantity: number; isManual?: boolean; isBox?: boolean; quantityPerBox?: number }[];

            // 3. Loop items and restore stock
            for (const item of items) {
                if (item.isManual) continue; // Skip manual items

                // Calculate actual stock restoration (Units)
                const quantityToRestore = (item.isBox && item.quantityPerBox)
                    ? item.quantity * item.quantityPerBox
                    : item.quantity;

                // Restore stock
                await tx.product.update({
                    where: { id: item.productId },
                    data: { stock: { increment: quantityToRestore } }
                });

                // エアコン在庫も連動（airconProductIdがある場合）
                const productWithAircon = await tx.product.findUnique({
                    where: { id: item.productId },
                    select: { airconProductId: true }
                });
                if (productWithAircon?.airconProductId) {
                    await tx.airconProduct.update({
                        where: { id: productWithAircon.airconProductId },
                        data: { stock: { increment: quantityToRestore } }
                    });
                    // リンクされたPURCHASEログも戻し済みにする
                    const linkedLog = await tx.airConditionerLog.findFirst({
                        where: {
                            note: `材料買取 TX#${transaction.id}`,
                            isReturned: false,
                        }
                    });
                    if (linkedLog) {
                        await tx.airConditionerLog.update({
                            where: { id: linkedLog.id },
                            data: { isReturned: true, returnedAt: new Date() }
                        });
                    }
                }

                // Create Inventory Log
                await tx.inventoryLog.create({
                    data: {
                        productId: item.productId,
                        type: '返品',
                        quantity: quantityToRestore,
                        reason: `Transaction #${transaction.id} Return${item.isBox ? ' (Box)' : ''}`,
                    }
                });
            }

            // 4. Log the return operation with original details
            const parsedOriginal = JSON.parse(originalItems) as { name?: string; quantity: number; price?: number; code?: string }[];
            const itemSummary = parsedOriginal
                .filter(i => i.quantity > 0)
                .map(i => `${i.name || i.code || '不明'} x${i.quantity}`)
                .join(', ');
            const vendorInfo = `${transaction.vendor.name}${transaction.vendorUser ? '(' + transaction.vendorUser.name + ')' : ''}`;

            await tx.operationLog.create({
                data: {
                    action: 'TRANSACTION_RETURN',
                    target: `Transaction #${transactionId}`,
                    details: `全量戻し | 業者: ${vendorInfo} | 元取引: ${transaction.date.toISOString()} | 金額: ${transaction.totalAmount}円 | 明細: ${itemSummary}`,
                }
            });

            // 5. Mark Transaction as Returned
            await tx.transaction.update({
                where: { id: transactionId },
                data: {
                    isReturned: true,
                    returnedAt: new Date()
                }
            });
        });

        revalidatePath('/admin/transactions');
        revalidatePath('/admin/products');
        return { success: true };

    } catch (e) {
        console.error(e);
        return { success: false, message: e instanceof Error ? e.message : 'エラーが発生しました' };
    }
}

// Partial Return
export async function returnPartialTransaction(transactionId: number, returnItems: { productId: number; returnQuantity: number }[]) {
    if (await checkActiveInventory()) {
        return { success: false, message: '現在棚卸中のため、戻し処理は利用できません' };
    }

    try {
        await prisma.$transaction(async (tx) => {
            const transaction = await tx.transaction.findUnique({
                where: { id: transactionId },
                include: { vendor: true, vendorUser: true }
            });

            if (!transaction) throw new Error("取引が見つかりません");

            // 月次締めチェック
            const closed = await checkTransactionMonthClosed(transaction.date);
            if (closed) throw new Error("この取引の月は締め済みのため返品できません");

            if (transaction.isReturned) throw new Error("既に戻し処理済みです");

            // 元の明細を保存（ログ用）
            const originalItems = transaction.items;

            let items = JSON.parse(transaction.items) as { productId: number; quantity: number; price: number; name: string; isManual?: boolean; isBox?: boolean; quantityPerBox?: number; unit?: string }[];
            let totalAmount = transaction.totalAmount;
            let returnedAny = false;
            const returnedDetails: string[] = []; // 戻し内容の記録

            // Process Returns
            for (const returnItem of returnItems) {
                if (returnItem.returnQuantity <= 0) continue;

                const itemIndex = items.findIndex(i => i.productId === returnItem.productId && !i.isManual);
                if (itemIndex === -1) continue;

                const item = items[itemIndex];

                if (returnItem.returnQuantity > item.quantity) {
                    throw new Error(`戻し数量が多すぎます: ${item.name}`);
                }

                // 1. Restore Stock
                const itemQuantityPerBox = (item.isBox && item.quantityPerBox) ? item.quantityPerBox : 1;
                const quantityToRestore = returnItem.returnQuantity * itemQuantityPerBox;

                await tx.product.update({
                    where: { id: item.productId },
                    data: { stock: { increment: quantityToRestore } }
                });

                // 2. Log
                await tx.inventoryLog.create({
                    data: {
                        productId: item.productId,
                        type: '返品',
                        quantity: quantityToRestore,
                        reason: `Tx #${transactionId} Partial Return${item.isBox ? ' (Box)' : ''}`,
                    }
                });

                // 3. Update Transaction Item (Decrease quantity locally)
                const deduction = item.price * returnItem.returnQuantity;
                totalAmount -= deduction;

                items[itemIndex].quantity -= returnItem.returnQuantity;
                returnedAny = true;
                returnedDetails.push(`${item.name} x${returnItem.returnQuantity}`);
            }

            if (!returnedAny) {
                return;
            }

            // Remove items with quantity 0 to clean up? Or keep as 0?
            // Keeping as 0 shows "it was there but returned". Removing it hides evidence.
            // Let's filtered out 0 quantity items to keep receipt clean?
            // User request: "10個持ち出して2個戻す" -> "8個持ち出したことになる"
            // So if 2 returned, 8 remains. If all 10 returned, 0 remains.
            // If 0 remains, it should probably disappear from "purchased items" list or stay as 0.
            // Let's Remove them if 0.
            const newItems = items.filter(i => i.quantity > 0);

            // Check if all items are gone -> Mark as fully returned
            const allReturned = newItems.length === 0;

            if (allReturned) {
                await tx.transaction.update({
                    where: { id: transactionId },
                    data: {
                        items: JSON.stringify(items), // Save with 0 quantities or empty list? existing logic implies keeping record.
                        // Ideally: isReturned = true.
                        isReturned: true,
                        returnedAt: new Date(),
                        totalAmount: 0
                    }
                });
            } else {
                await tx.transaction.update({
                    where: { id: transactionId },
                    data: {
                        items: JSON.stringify(newItems),
                        totalAmount: totalAmount,
                    }
                });
            }

            // Operation Log: 部分戻しの記録
            const vendorInfo = `${transaction.vendor.name}${transaction.vendorUser ? '(' + transaction.vendorUser.name + ')' : ''}`;
            const parsedOriginal = JSON.parse(originalItems) as { name?: string; quantity: number; code?: string }[];
            const originalSummary = parsedOriginal
                .filter(i => i.quantity > 0)
                .map(i => `${i.name || i.code || '不明'} x${i.quantity}`)
                .join(', ');

            await tx.operationLog.create({
                data: {
                    action: allReturned ? 'TRANSACTION_RETURN' : 'TRANSACTION_PARTIAL_RETURN',
                    target: `Transaction #${transactionId}`,
                    details: `${allReturned ? '全量戻し' : '部分戻し'} | 業者: ${vendorInfo} | 戻し内容: ${returnedDetails.join(', ')} | 元明細: ${originalSummary}`,
                }
            });
        });

        revalidatePath('/admin/transactions');
        revalidatePath('/admin/products');
        return { success: true };
    } catch (e) {
        console.error(e);
        return { success: false, message: e instanceof Error ? e.message : 'エラーが発生しました' };
    }
}

export async function getVendorTransactions(vendorId: number, limit = 20) {
    const transactions = await prisma.transaction.findMany({
        where: { vendorId },
        orderBy: { date: 'desc' },
        take: limit,
    });
    return transactions;
}

/**
 * 履歴から返品処理を行う。
 * 元の取引は変更せず、差分を当日日付の新規マイナス取引として記録する。
 * これにより前月の請求データに影響を与えない。
 */
export async function createReturnFromHistory(
    originalTransactionId: number,
    vendorId: number,
    vendorUserId: number | null,
    returnItems: { productId: number; returnQuantity: number; name: string; code?: string; price: number; unit?: string; isBox?: boolean; quantityPerBox?: number }[],
    reason: string // '返品' | '入力ミス'
) {
    // 棚卸中チェック
    const activeInventory = await prisma.inventoryCount.findFirst({
        where: { status: "IN_PROGRESS" },
    });
    if (activeInventory) {
        return { success: false, message: '現在棚卸中のため、返品処理は利用できません' };
    }

    try {
        // 月次締めチェック（元取引の月）
        const origTx = await prisma.transaction.findUnique({ where: { id: originalTransactionId } });
        if (origTx) {
            const closed = await checkTransactionMonthClosed(origTx.date);
            if (closed) return { success: false, message: 'この取引の月は締め済みのため返品できません' };
        }

        // 過去の返品数を集計
        const returnedQuantities = await getReturnedQuantities(originalTransactionId);

        const result = await prisma.$transaction(async (tx) => {
            // 元の取引を取得して検証
            const originalTx = await tx.transaction.findUnique({
                where: { id: originalTransactionId }
            });
            if (!originalTx || originalTx.vendorId !== vendorId) {
                throw new Error('取引が見つかりません');
            }

            const originalItems: any[] = JSON.parse(originalTx.items);
            let totalReturnAmount = 0;
            const transactionItems: any[] = [];

            for (const returnItem of returnItems) {
                if (returnItem.returnQuantity <= 0) continue;

                // 元の取引に含まれているか検証
                const origItem = originalItems.find(i => i.productId === returnItem.productId);
                if (!origItem) {
                    throw new Error(`商品ID ${returnItem.productId} は元の取引に含まれていません`);
                }

                // 元取引の最大個数を計算（箱の場合は箱数×入数）
                const origMaxUnits = (origItem.isBox && origItem.quantityPerBox)
                    ? origItem.quantity * origItem.quantityPerBox
                    : origItem.quantity;

                // 過去の返品数を考慮して上限チェック
                const alreadyReturned = returnedQuantities[returnItem.productId] || 0;
                const maxReturnable = origMaxUnits - alreadyReturned;

                if (returnItem.returnQuantity > maxReturnable) {
                    throw new Error(`返品数が上限を超えています (${returnItem.name}: 残り${maxReturnable}個)`);
                }

                // マイナス取引アイテムを作成（個数単位で記録）
                transactionItems.push({
                    productId: returnItem.productId,
                    code: returnItem.code || origItem.code,
                    name: returnItem.name,
                    price: returnItem.price,
                    quantity: -returnItem.returnQuantity, // マイナス
                    unit: returnItem.unit || origItem.unit,
                    isBox: returnItem.isBox ?? false,
                    quantityPerBox: returnItem.quantityPerBox,
                    isManual: origItem.isManual || false,
                    originalTransactionId: originalTransactionId, // どの取引への返品か記録
                });

                totalReturnAmount += returnItem.price * (-returnItem.returnQuantity);

                // 在庫を復元（返品は常に個数単位で送られてくる）
                const restoreQty = (returnItem.isBox && returnItem.quantityPerBox)
                    ? returnItem.returnQuantity * returnItem.quantityPerBox
                    : returnItem.returnQuantity;

                await tx.product.update({
                    where: { id: returnItem.productId },
                    data: {
                        stock: { increment: restoreQty },
                        usageCount: { decrement: returnItem.returnQuantity },
                    }
                });

                // 在庫ログに記録
                await tx.inventoryLog.create({
                    data: {
                        productId: returnItem.productId,
                        type: '入庫',
                        quantity: restoreQty,
                        reason: `${reason} (元取引#${originalTransactionId}, ${returnItem.name} ×${returnItem.returnQuantity})`,
                    }
                });
            }

            if (transactionItems.length === 0) {
                throw new Error('返品する商品がありません');
            }

            // 当日日付で新規マイナス取引を作成
            const returnTx = await tx.transaction.create({
                data: {
                    vendorId,
                    vendorUserId,
                    items: JSON.stringify(transactionItems),
                    totalAmount: totalReturnAmount,
                    hasUnregisteredItems: false,
                    date: new Date(), // 当日日付
                    isProxyInput: false,
                }
            });

            return returnTx;
        });

        // 返品後の在庫情報を取得（在庫確認ダイアログ用）
        const returnedProductIds = returnItems.filter(i => i.returnQuantity > 0).map(i => i.productId);
        const updatedProducts = await prisma.product.findMany({
            where: { id: { in: returnedProductIds } },
            select: { id: true, stock: true, name: true, code: true, unit: true },
        });

        revalidatePath('/admin/products');
        revalidatePath('/admin/transactions');
        revalidatePath('/shop');
        revalidatePath('/shop/history');

        const stockInfo = updatedProducts.map(p => ({
            productId: p.id,
            name: p.name,
            code: p.code,
            expectedStock: p.stock,
            unit: p.unit,
        }));
        return { success: true, transactionId: result.id, stockInfo };

    } catch (error) {
        console.error("Return from History Error:", error);
        return { success: false, message: error instanceof Error ? error.message : '返品処理中にエラーが発生しました' };
    }
}

// Operation Logs
export async function getOperationLogs(limit = 100, actions?: string[]) {
    return await prisma.operationLog.findMany({
        take: limit,
        orderBy: { performedAt: 'desc' },
        where: actions ? { action: { in: actions } } : undefined,
    });
}

// Inventory Counts
export async function getInventoryCounts() {
    return await prisma.inventoryCount.findMany({
        orderBy: { startedAt: 'desc' },
        include: {
            items: true,
        }
    });
}

export async function createInventoryCount(note?: string) {
    // 重複開始ガード: 進行中の棚卸しがあれば開始不可
    const activeCount = await prisma.inventoryCount.findFirst({
        where: { status: 'IN_PROGRESS' },
    });
    if (activeCount) {
        throw new Error(`棚卸し #${activeCount.id} が進行中です。完了またはキャンセルしてから新規開始してください。`);
    }

    // 1. Snapshot current stock as 'expectedStock'
    const products = await prisma.product.findMany();

    // Create session
    const inventory = await prisma.inventoryCount.create({
        data: {
            status: 'IN_PROGRESS',
            type: 'FULL',
            note,
            items: {
                create: products.map(p => ({
                    productId: p.id,
                    expectedStock: p.stock,
                    actualStock: p.stock, // Default to expected, user will adjust
                    adjustment: 0,
                }))
            }
        }
    });

    await logOperation("INVENTORY_START", `棚卸 #${inventory.id}`, `一斉棚卸を開始 (${products.length}商品)`);
    revalidatePath('/admin/inventory');
    return inventory;
}

// スポット棚卸: 選択した商品のみで棚卸セッションを開始
export async function createSpotInventory(productIds: number[], note?: string) {
    if (!productIds || productIds.length === 0) {
        throw new Error('棚卸対象の商品を選択してください。');
    }

    // 重複開始ガード: 進行中の棚卸しがあれば開始不可
    const activeCount = await prisma.inventoryCount.findFirst({
        where: { status: 'IN_PROGRESS' },
    });
    if (activeCount) {
        throw new Error(`棚卸し #${activeCount.id} が進行中です。完了またはキャンセルしてから新規開始してください。`);
    }

    // 選択された商品のみ取得
    const products = await prisma.product.findMany({
        where: { id: { in: productIds } },
    });

    if (products.length === 0) {
        throw new Error('有効な商品が見つかりませんでした。');
    }

    // Create session (SPOT)
    const inventory = await prisma.inventoryCount.create({
        data: {
            status: 'IN_PROGRESS',
            type: 'SPOT',
            note: note || `スポット棚卸 (${products.length}商品)`,
            items: {
                create: products.map(p => ({
                    productId: p.id,
                    expectedStock: p.stock,
                    actualStock: p.stock,
                    adjustment: 0,
                }))
            }
        }
    });

    await logOperation("INVENTORY_START", `スポット棚卸 #${inventory.id}`, `スポット棚卸を開始 (${products.length}商品: ${products.map(p => p.name).join(', ')})`);
    revalidatePath('/admin/inventory');
    return inventory;
}

// =========================================
// 在庫差異分析レポート
// =========================================

export async function getDiscrepancyReport(months: number = 3) {
    const since = new Date();
    since.setMonth(since.getMonth() - months);

    // 実損とみなす理由（紛失・破損のみ）
    const REAL_LOSS_REASONS = ['紛失・原因不明', '紛失・不明', '破損・劣化による廃棄', '破損・劣化'];

    // 確定済みの棚卸アイテム「全件」を取得（差異なしも含む → 棚卸回数の分母に）
    const allItems = await prisma.inventoryCountItem.findMany({
        where: {
            inventory: {
                status: 'COMPLETED',
                endedAt: { gte: since },
            },
        },
        include: {
            product: true,
            inventory: true,
        },
        orderBy: {
            inventory: { endedAt: 'desc' },
        },
    });

    // 差異ありのみ（ベースライン設定を除外: システム在庫0→実在庫ありは初期登録のため）
    const discrepancyItems = allItems.filter(i =>
        i.adjustment !== 0 &&
        !(i.expectedStock === 0 && i.actualStock > 0)
    );

    // 1. 商品別集計（差異発生率 + ネット差異）
    const productMap = new Map<number, {
        productId: number;
        productName: string;
        category: string;
        cost: number;
        totalInventoryCount: number; // この商品の棚卸回数（分母）
        discrepancyCount: number;    // 差異があった回数
        netAdjustment: number;       // ネット差異（+過剰/-不足）
        realLossAmount: number;      // 実損金額（紛失・破損のみ）
        totalLossAmount: number;     // 全差異金額
    }>();

    // まず全アイテムで棚卸回数をカウント
    for (const item of allItems) {
        const existing = productMap.get(item.productId) || {
            productId: item.productId,
            productName: item.product.name,
            category: item.product.category,
            cost: item.product.cost,
            totalInventoryCount: 0,
            discrepancyCount: 0,
            netAdjustment: 0,
            realLossAmount: 0,
            totalLossAmount: 0,
        };
        existing.totalInventoryCount += 1;

        if (item.adjustment !== 0) {
            existing.discrepancyCount += 1;
            existing.netAdjustment += item.adjustment;

            if (item.adjustment < 0) {
                existing.totalLossAmount += Math.abs(item.adjustment) * item.product.cost;
                const reason = item.reason || '';
                if (REAL_LOSS_REASONS.some(r => reason.includes(r) || r.includes(reason))) {
                    existing.realLossAmount += Math.abs(item.adjustment) * item.product.cost;
                }
            }
        }
        productMap.set(item.productId, existing);
    }

    const productRanking = Array.from(productMap.values());

    // ロス金額順（実損のみ）でTOP10
    const lossTop = [...productRanking]
        .filter(p => p.realLossAmount > 0)
        .sort((a, b) => b.realLossAmount - a.realLossAmount)
        .slice(0, 10);

    // 差異発生率順（よくズレる商品）TOP10
    const rateTop = [...productRanking]
        .filter(p => p.totalInventoryCount >= 2) // 最低2回以上棚卸した商品のみ
        .map(p => ({
            ...p,
            discrepancyRate: p.discrepancyCount / p.totalInventoryCount,
        }))
        .sort((a, b) => b.discrepancyRate - a.discrepancyRate)
        .slice(0, 10);

    // 2. 理由別集計
    const reasonMap = new Map<string, {
        reason: string;
        count: number;
        totalAdjustment: number;
        lossAmount: number;
        isRealLoss: boolean;
    }>();
    for (const item of discrepancyItems) {
        const reason = item.reason || '理由未設定';
        const existing = reasonMap.get(reason) || {
            reason,
            count: 0,
            totalAdjustment: 0,
            lossAmount: 0,
            isRealLoss: REAL_LOSS_REASONS.some(r => reason.includes(r) || r.includes(reason)),
        };
        existing.count += 1;
        existing.totalAdjustment += item.adjustment;
        if (item.adjustment < 0) {
            existing.lossAmount += Math.abs(item.adjustment) * item.product.cost;
        }
        reasonMap.set(reason, existing);
    }
    const reasonBreakdown = Array.from(reasonMap.values()).sort((a, b) => b.lossAmount - a.lossAmount);

    // 3. カテゴリ別ロス（実損のみ）
    const categoryMap = new Map<string, { category: string; lossAmount: number; shortageCount: number }>();
    for (const item of discrepancyItems) {
        if (item.adjustment >= 0) continue;
        const reason = item.reason || '';
        if (!REAL_LOSS_REASONS.some(r => reason.includes(r) || r.includes(reason))) continue;
        const cat = item.product.category;
        const existing = categoryMap.get(cat) || { category: cat, lossAmount: 0, shortageCount: 0 };
        existing.lossAmount += Math.abs(item.adjustment) * item.product.cost;
        existing.shortageCount += Math.abs(item.adjustment);
        categoryMap.set(cat, existing);
    }
    const categoryBreakdown = Array.from(categoryMap.values()).sort((a, b) => b.lossAmount - a.lossAmount);

    // 4. サマリー
    const realLoss = discrepancyItems
        .filter(i => i.adjustment < 0 && REAL_LOSS_REASONS.some(r => (i.reason || '').includes(r) || r.includes(i.reason || '')))
        .reduce((sum, i) => sum + Math.abs(i.adjustment) * i.product.cost, 0);
    const resolvedLoss = discrepancyItems
        .filter(i => i.adjustment < 0 && !REAL_LOSS_REASONS.some(r => (i.reason || '').includes(r) || r.includes(i.reason || '')))
        .reduce((sum, i) => sum + Math.abs(i.adjustment) * i.product.cost, 0);
    const totalExcessAmount = discrepancyItems
        .filter(i => i.adjustment > 0)
        .reduce((sum, i) => sum + i.adjustment * i.product.cost, 0);

    return {
        period: { months, since: since.toISOString() },
        summary: {
            totalDiscrepancies: discrepancyItems.length,
            totalInventoryItems: allItems.length,
            realLoss,           // 実損（紛失・破損のみ）
            resolvedLoss,       // 原因判明分（数え間違い・記録漏れ等）
            totalExcessAmount,
        },
        lossTop,          // 実損金額TOP
        rateTop,          // 差異発生率TOP
        reasonBreakdown,
        categoryBreakdown,
    };
}

// =========================================
// 在庫不一致申告
// =========================================

// 業者から在庫不一致を申告
export async function reportStockDiscrepancy(
    productId: number,
    vendorId: number,
    vendorUserId: number | null,
    reportedStock: number,
    note?: string
) {
    // 商品の現在庫を取得
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw new Error('商品が見つかりません');

    const discrepancy = await prisma.stockDiscrepancy.create({
        data: {
            productId,
            vendorId,
            vendorUserId,
            reportedStock,
            systemStock: product.stock,
            note,
            status: 'PENDING',
        },
    });

    await logOperation(
        "STOCK_DISCREPANCY",
        `${product.name}`,
        `在庫不一致申告: システム=${product.stock}, 実際=${reportedStock} (差異: ${reportedStock - product.stock})`
    );

    revalidatePath('/admin/inventory');
    revalidatePath('/admin');
    return discrepancy;
}

// 未解決の在庫不一致申告を取得
export async function getStockDiscrepancies(status?: string) {
    return prisma.stockDiscrepancy.findMany({
        where: status ? { status } : undefined,
        include: {
            product: { select: { id: true, code: true, name: true, stock: true, unit: true } },
            vendor: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
    });
}

// 棚卸確定時に関連する申告を解決済みにする
export async function resolveDiscrepancies(productIds: number[]) {
    const result = await prisma.stockDiscrepancy.updateMany({
        where: {
            productId: { in: productIds },
            status: 'PENDING',
        },
        data: {
            status: 'RESOLVED',
            resolvedAt: new Date(),
        },
    });
    return result.count;
}

// 個別の在庫不一致申告を処理済みにする（管理画面から）
export async function resolveDiscrepancy(id: number, resolveNote?: string) {
    const discrepancy = await prisma.stockDiscrepancy.findUnique({ where: { id } });
    if (!discrepancy) throw new Error('申告が見つかりません');
    if (discrepancy.status === 'RESOLVED') throw new Error('既に処理済みです');

    const updated = await prisma.stockDiscrepancy.update({
        where: { id },
        data: {
            status: 'RESOLVED',
            resolvedAt: new Date(),
            note: resolveNote
                ? (discrepancy.note ? `${discrepancy.note}\n【処理メモ】${resolveNote}` : `【処理メモ】${resolveNote}`)
                : discrepancy.note,
        },
    });

    await logOperation(
        "STOCK_DISCREPANCY_RESOLVED",
        `申告 #${id}`,
        `在庫不一致申告 #${id} を処理済みに変更${resolveNote ? `: ${resolveNote}` : ''}`
    );

    revalidatePath('/admin/reports/discrepancies');
    revalidatePath('/admin');
    return updated;
}


export async function getInventoryCount(id: number) {
    const inventory = await prisma.inventoryCount.findUnique({
        where: { id },
        include: {
            items: {
                include: {
                    product: true
                },
                orderBy: {
                    product: {
                        code: 'asc'
                    }
                }
            }
        }
    });
    return inventory;
}

export async function updateInventoryItem(itemId: number, actualStock: number, reason?: string) {
    const item = await prisma.inventoryCountItem.findUnique({
        where: { id: itemId },
        include: { inventory: true }
    });
    if (!item) throw new Error("Item not found");

    if (item.inventory.status !== 'IN_PROGRESS') {
        throw new Error("棚卸は既に完了または中止されているため、編集できません");
    }

    const adjustment = actualStock - item.expectedStock;

    await prisma.inventoryCountItem.update({
        where: { id: itemId },
        data: {
            actualStock,
            adjustment,
            reason: adjustment !== 0 ? reason : null, // 差異がない場合は理由をクリア
        }
    });

    // No log here, only on finalize
}

// 棚卸アイテムの確認（OKボタン）
export async function checkInventoryItem(itemId: number, checkedBy: string) {
    const item = await prisma.inventoryCountItem.findUnique({
        where: { id: itemId },
        include: { inventory: true }
    });
    if (!item) throw new Error("Item not found");
    if (item.inventory.status !== 'IN_PROGRESS') {
        throw new Error("棚卸は既に完了または中止されています");
    }

    await prisma.inventoryCountItem.update({
        where: { id: itemId },
        data: {
            checkedBy,
            checkedAt: new Date(),
        }
    });
}

// 棚卸アイテムの確認取消
export async function uncheckInventoryItem(itemId: number) {
    const item = await prisma.inventoryCountItem.findUnique({
        where: { id: itemId },
        include: { inventory: true }
    });
    if (!item) throw new Error("Item not found");
    if (item.inventory.status !== 'IN_PROGRESS') {
        throw new Error("棚卸は既に完了または中止されています");
    }

    await prisma.inventoryCountItem.update({
        where: { id: itemId },
        data: {
            checkedBy: null,
            checkedAt: null,
        }
    });
}

// Vendor Aircon Stock (Dashboard)
export async function getVendorAirconStock() {
    // 持ち出し中で返却されていないエアコンを取得
    const logs = await prisma.airConditionerLog.findMany({
        where: {
            isReturned: false,
        },
        include: {
            vendor: true,
            vendorUser: true,
            airconProduct: true,
        },
        orderBy: {
            vendorId: 'asc',
        }
    });

    // 業者ごとに集計
    const vendorStock = new Map<number, {
        vendor: { id: number; name: string };
        items: typeof logs;
        summary: { set: number; indoor: number; outdoor: number; total: number };
    }>();

    for (const log of logs) {
        if (!vendorStock.has(log.vendorId)) {
            vendorStock.set(log.vendorId, {
                vendor: log.vendor,
                items: [],
                summary: { set: 0, indoor: 0, outdoor: 0, total: 0 }
            });
        }

        const entry = vendorStock.get(log.vendorId)!;
        entry.items.push(log);

        // 集計
        const type = (log.type || 'SET') as 'SET' | 'INDOOR' | 'OUTDOOR';
        if (type === 'SET') entry.summary.set++;
        else if (type === 'INDOOR') entry.summary.indoor++;
        else if (type === 'OUTDOOR') entry.summary.outdoor++;
        entry.summary.total++;
    }

    return Array.from(vendorStock.values());
}

export async function finalizeInventory(id: number) {
    try {
        const result = await prisma.$transaction(async (tx) => {
            // 1. Atomic Status Update (Lock)
            // statusがIN_PROGRESSのものだけを更新する。更新件数が0なら、既に他で更新されたか無効。
            const updateResult = await tx.inventoryCount.updateMany({
                where: {
                    id,
                    status: 'IN_PROGRESS'
                },
                data: {
                    status: 'COMPLETED',
                    endedAt: new Date(),
                }
            });

            if (updateResult.count === 0) {
                // 既に完了しているか確認
                const current = await tx.inventoryCount.findUnique({ where: { id } });
                if (current && current.status === 'COMPLETED') {
                    return { status: 'ALREADY_COMPLETED' };
                }
                throw new Error("棚卸セッションが無効か、既に中止されています");
            }

            // 2. Adjust Stock for all items (Fetch latest data INSIDE transaction)
            const inventory = await tx.inventoryCount.findUnique({
                where: { id },
                include: { items: true }
            });

            if (!inventory) throw new Error("Unexpected error: Inventory not found");

            for (const item of inventory.items) {
                if (item.adjustment !== 0) {
                    // Update Product Stock
                    await tx.product.update({
                        where: { id: item.productId },
                        data: { stock: item.actualStock }
                    });

                    // Create Adjustment Log
                    await tx.inventoryLog.create({
                        data: {
                            productId: item.productId,
                            type: 'INVENTORY_ADJUSTMENT',
                            quantity: item.adjustment,
                            reason: `Inventory #${id} Adjustment`,
                        }
                    });
                }
            }
            return { status: 'SUCCESS' };
        });

        if (result.status === 'ALREADY_COMPLETED') {
            return { success: true, message: "他のユーザーにより既に完了されています", code: "ALREADY_COMPLETED" };
        }

        await logOperation("INVENTORY_FINALIZE", `棚卸 #${id}`, `棚卸を確定`);

        // 棚卸対象商品の未解決申告を自動解決
        const inventory = await prisma.inventoryCount.findUnique({
            where: { id },
            include: { items: { select: { productId: true } } }
        });
        if (inventory) {
            const productIds = inventory.items.map(i => i.productId);
            await resolveDiscrepancies(productIds);
        }

        revalidatePath('/admin/inventory');
        revalidatePath(`/admin/inventory/${id}`);
        revalidatePath('/admin/products');

        return { success: true };

    } catch (error) {
        console.error("Finalize Error:", error);
        return { success: false, message: error instanceof Error ? error.message : '確定処理中にエラーが発生しました' };
    }
}

export async function cancelInventory(id: number) {
    const inventory = await prisma.inventoryCount.findUnique({
        where: { id },
    });

    if (!inventory || inventory.status !== 'IN_PROGRESS') {
        throw new Error("Invalid inventory session to cancel");
    }

    await prisma.inventoryCount.update({
        where: { id },
        data: {
            status: 'CANCELLED',
            endedAt: new Date(),
        }
    });

    await logOperation("INVENTORY_CANCEL", `棚卸 #${id}`, `棚卸を中止`);
    revalidatePath('/admin/inventory');
}

// Order Actions (Phase 13)
export async function getOrders() {
    return await prisma.order.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
            items: {
                include: {
                    product: true
                }
            }
        }
    });
}

export async function getOrderById(id: number) {
    return await prisma.order.findUnique({
        where: { id },
        include: {
            items: {
                include: {
                    product: true
                }
            }
        }
    });
}

export async function generateDraftOrders() {
    // 0. 既存の未完了注文（DRAFT/ORDERED/PARTIAL）の発注済み数量をproductId別に集計
    const pendingOrderItems = await prisma.orderItem.findMany({
        where: {
            order: {
                status: { in: ['DRAFT', 'ORDERED', 'PARTIAL'] }
            }
        },
        select: { productId: true, quantity: true, receivedQuantity: true }
    });
    // 商品ごとの未入荷数量を集計（発注数 - 入荷済み数）
    const pendingQtyByProduct = new Map<number, number>();
    for (const item of pendingOrderItems) {
        const pending = item.quantity - item.receivedQuantity;
        if (pending > 0) {
            pendingQtyByProduct.set(
                item.productId,
                (pendingQtyByProduct.get(item.productId) || 0) + pending
            );
        }
    }

    // 1. 最低在庫 > 0 の全商品を取得
    const allProducts = await prisma.product.findMany({
        where: {
            minStock: { gt: 0 }
        }
    });

    // 2. 在庫 + 発注済み数量 < 最低在庫 の商品を候補として抽出
    const targetProducts = allProducts.filter(p => {
        const pendingQty = pendingQtyByProduct.get(p.id) || 0;
        return (p.stock + pendingQty) < p.minStock;
    });

    if (targetProducts.length === 0) {
        return { success: false, message: "在庫＋発注済み数が最低在庫を上回っている商品のみです。追加発注の必要はありません。" };
    }

    // 3. Group by supplier
    const groupedBySupplier = targetProducts.reduce((acc, p) => {
        const supplier = p.supplier || "未指定";
        if (!acc[supplier]) acc[supplier] = [];
        acc[supplier].push(p);
        return acc;
    }, {} as Record<string, typeof targetProducts>);

    // 4. Create Draft Orders
    let createdCount = 0;
    let itemCount = 0;
    for (const [supplier, products] of Object.entries(groupedBySupplier)) {
        await prisma.order.create({
            data: {
                supplier,
                status: 'DRAFT',
                items: {
                    create: products.map(p => {
                        const pendingQty = pendingQtyByProduct.get(p.id) || 0;
                        // 不足分 = 最低在庫 - 現在庫 - 発注済み数
                        const deficit = Math.max(1, p.minStock - p.stock - pendingQty);
                        // @ts-ignore
                        const unit = p.orderUnit || 1;
                        const quantity = Math.ceil(deficit / unit) * unit;

                        return {
                            productId: p.id,
                            quantity: quantity,
                            cost: p.cost,
                        };
                    })
                }
            }
        });
        createdCount++;
        itemCount += products.length;
    }

    await logOperation("ORDER_DRAFT_GENERATE", `発注候補 ${createdCount}件作成`, `対象商品: ${itemCount}件（在庫+発注済み < 最低在庫）`);
    revalidatePath('/admin/orders');
    return { success: true, message: `${createdCount}件の発注候補を作成しました（${itemCount}商品）。` };
}

export async function confirmOrder(id: number) {
    // 最大の orderNumber を取得して次の番号を決定
    const maxOrder = await prisma.order.findFirst({
        where: { orderNumber: { not: null } },
        orderBy: { orderNumber: 'desc' },
        select: { orderNumber: true }
    });
    const nextNumber = (maxOrder?.orderNumber ?? 0) + 1;

    await prisma.order.update({
        where: { id },
        data: {
            status: 'ORDERED',
            orderNumber: nextNumber,
        }
    });
    await logOperation("ORDER_CONFIRM", `発注No.${nextNumber} (id:${id})`, `発注確定 orderNumber: ${nextNumber}`);
    revalidatePath('/admin/orders');
    revalidatePath(`/admin/orders/${id}`);
}

export async function receiveOrderItem(orderItemId: number, quantity: number) {
    // 1. Get the item
    const item = await prisma.orderItem.findUnique({
        where: { id: orderItemId },
        include: { product: true, order: true }
    });

    if (!item) throw new Error("Order item not found");
    if (item.isReceived) throw new Error("Already received");

    // Replace multiple queries with a single transaction
    await prisma.$transaction(async (tx) => {
        // 2. Update item
        const newReceivedQty = item.receivedQuantity + quantity;
        await tx.orderItem.update({
            where: { id: orderItemId },
            data: {
                receivedQuantity: newReceivedQty,
                isReceived: newReceivedQty >= item.quantity
            }
        });

        // 3. Increase stock
        await tx.product.update({
            where: { id: item.productId },
            data: { stock: { increment: quantity } }
        });

        // 4. Record Log
        await tx.inventoryLog.create({
            data: {
                productId: item.productId,
                type: 'RESTOCK',
                quantity: quantity,
                reason: `Order #${item.orderId} Received`,
            }
        });

        // 5. Check order status
        const allItems = await tx.orderItem.findMany({
            where: { orderId: item.orderId }
        });
        const allDone = allItems.every(i => i.isReceived);

        await tx.order.update({
            where: { id: item.orderId },
            data: {
                status: allDone ? 'RECEIVED' : 'PARTIAL',
                updatedAt: new Date()
            }
        });
    });

    const orderLabel = item.order.orderNumber ? `発注No.${item.order.orderNumber}` : `下書き id:${item.orderId}`;
    await logOperation("ORDER_ITEM_RECEIVE", orderLabel, `入荷: ${item.product.name} ${quantity}個`);
    revalidatePath('/admin/orders');
    revalidatePath(`/admin/orders/${item.orderId}`);
    revalidatePath('/admin/products');
}

export async function cancelOrder(id: number) {
    const order = await prisma.order.findUnique({ where: { id } });
    if (!order) throw new Error("Order not found");
    if (order.status === 'RECEIVED') throw new Error("完了済みの発注は取り消せません");
    if (order.status === 'CANCELLED') throw new Error("既に取り消されています");

    await prisma.order.update({
        where: { id },
        data: { status: 'CANCELLED' }
    });

    const orderLabel = order.orderNumber ? `発注No.${order.orderNumber} (id:${id})` : `下書き id:${id}`;
    await logOperation("ORDER_CANCEL", orderLabel, `発注キャンセル`);
    revalidatePath('/admin/orders');
    revalidatePath(`/admin/orders/${id}`);
}

export async function deleteOrder(id: number) {
    const order = await prisma.order.findUnique({ where: { id } });
    if (order?.status !== 'DRAFT') throw new Error("Draft以外の発注書は削除できません");

    await prisma.orderItem.deleteMany({ where: { orderId: id } });
    await prisma.order.delete({ where: { id } });

    await logOperation("ORDER_DELETE", `下書き id:${id}`, `下書き発注を削除`);
    revalidatePath('/admin/orders');
}


export async function updateOrderItemQty(orderItemId: number, quantity: number) {
    await prisma.orderItem.update({
        where: { id: orderItemId },
        data: { quantity }
    });
}

export async function cancelReceipt(orderItemId: number) {
    // 1. Get current item state
    const item = await prisma.orderItem.findUnique({
        where: { id: orderItemId },
        include: { product: true }
    });

    if (!item || item.receivedQuantity === 0) {
        throw new Error("取消可能な入荷記録がありません");
    }

    const qtyToRevert = item.receivedQuantity;

    // 2. Revert Item stats
    await prisma.orderItem.update({
        where: { id: orderItemId },
        data: {
            receivedQuantity: 0,
            isReceived: false
        }
    });

    // 3. Revert Stock
    await prisma.product.update({
        where: { id: item.productId },
        data: { stock: { decrement: qtyToRevert } }
    });

    // 4. Record Log
    await prisma.inventoryLog.create({
        data: {
            productId: item.productId,
            type: 'CORRECTION',
            quantity: -qtyToRevert,
            reason: `Order #${item.orderId} Receipt Cancelled`,
        }
    });

    // 5. Update Order Status
    // Even if other items are received, this order is no longer "fully" received if one item is reverted.
    // However, we should check if *any* items are still received to decide between PARTIAL and ORDERED.
    const allItems = await prisma.orderItem.findMany({
        where: { orderId: item.orderId }
    });

    const anyReceived = allItems.some(i => i.isReceived);
    // If we just cancelled the last one, anyReceived will be false (since we updated the item above)
    // Wait, we need to fetch allItems *after* the update to be sure? 
    // Yes, or use the logic: if we just set this one to false, and others might be true.

    // Let's re-fetch to be safe and clean
    const freshItems = await prisma.orderItem.findMany({
        where: { orderId: item.orderId }
    });
    const hasReceives = freshItems.some(i => i.isReceived);

    await prisma.order.update({
        where: { id: item.orderId },
        data: {
            status: hasReceives ? 'PARTIAL' : 'ORDERED',
            updatedAt: new Date()
        }
    });

    const freshOrder = await prisma.order.findUnique({ where: { id: item.orderId } });
    const orderLabel2 = freshOrder?.orderNumber ? `発注No.${freshOrder.orderNumber}` : `下書き id:${item.orderId}`;
    await logOperation("ORDER_RECEIVE_CANCEL", orderLabel2, `入荷取消: ${item.product.name} ${qtyToRevert}個`);
    revalidatePath('/admin/orders');
    revalidatePath(`/admin/orders/${item.orderId}`);
    revalidatePath('/admin/products');
    return { success: true };
}

export async function createManualOrder(supplier: string) {
    const order = await prisma.order.create({
        data: {
            supplier,
            status: 'DRAFT',
        }
    });
    await logOperation("ORDER_CREATE", `下書き id:${order.id}`, `手動発注作成 仕入先: ${supplier}`);
    revalidatePath('/admin/orders');
    return { success: true, id: order.id };
}

export async function addOrderItem(orderId: number, productId: number, quantity: number) {
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw new Error("Product not found");

    await prisma.orderItem.create({
        data: {
            orderId,
            productId,
            quantity,
            cost: product.cost,
            receivedQuantity: 0,
            isReceived: false,
        }
    });

    revalidatePath(`/admin/orders/${orderId}`);
    return { success: true };
}

export async function deleteOrderItem(orderItemId: number) {
    const item = await prisma.orderItem.findUnique({
        where: { id: orderItemId },
        include: { order: true }
    });

    if (!item) throw new Error("発注明細が見つかりません");
    if (item.order.status !== 'DRAFT') throw new Error("下書き以外の発注からは削除できません");

    await prisma.orderItem.delete({ where: { id: orderItemId } });

    const orderInfo = await prisma.order.findUnique({ where: { id: item.orderId } });
    const orderLabel3 = orderInfo?.orderNumber ? `発注No.${orderInfo.orderNumber}` : `下書き id:${item.orderId}`;
    await logOperation("ORDER_ITEM_DELETE", orderLabel3, `商品ID: ${item.productId} を削除`);
    revalidatePath(`/admin/orders/${item.orderId}`);
    return { success: true };
}

export async function searchProducts(query: string) {
    return await prisma.product.findMany({
        where: {
            OR: [
                { name: { contains: query } },
                { code: { contains: query } }
            ]
        },
        take: 10
    });
}
// 価格修正機能
export async function correctTransactionPrice(
    transactionId: number,
    itemIndex: number,
    newPrice: number,
    reason: string
) {
    try {
        // 1. 取引を取得
        const transaction = await prisma.transaction.findUnique({
            where: { id: transactionId },
            include: { vendor: true }
        });

        if (!transaction) {
            return { success: false, message: '取引が見つかりません' };
        }

        // 2. 商品リストをパース
        let items: any[] = [];
        try {
            items = JSON.parse(transaction.items);
        } catch {
            return { success: false, message: '商品データの解析に失敗しました' };
        }

        if (itemIndex < 0 || itemIndex >= items.length) {
            return { success: false, message: '商品インデックスが無効です' };
        }

        // 3. 価格を変更
        const oldPrice = items[itemIndex].price;
        const itemName = items[itemIndex].name;
        items[itemIndex].price = newPrice;

        // 4. 合計金額を再計算
        const newTotalAmount = items.reduce((sum: number, item: any) => {
            if (item.isManual) return sum;
            return sum + item.price * item.quantity;
        }, 0);

        // 5. DBを更新
        await prisma.transaction.update({
            where: { id: transactionId },
            data: {
                items: JSON.stringify(items),
                totalAmount: newTotalAmount
            }
        });

        // 6. 操作ログに記録
        await logOperation(
            'PRICE_CORRECTION',
            `取引ID: ${transactionId}, 商品: ${itemName}`,
            `旧価格: ¥${oldPrice} → 新価格: ¥${newPrice}, 理由: ${reason}`
        );

        // 7. 管理者にメール通知（非同期で送信、失敗しても処理は続行）
        sendPriceCorrectionNotification(
            transactionId,
            transaction.vendor.name,
            itemName,
            oldPrice,
            newPrice,
            reason
        ).catch(e => console.error('メール送信失敗:', e));

        revalidatePath('/admin/transactions');
        return { success: true, newTotalAmount };
    } catch (error) {
        console.error('Price correction error:', error);
        return { success: false, message: '価格修正に失敗しました' };
    }
}

// Client-sideからログアウトログを記録するためのアクション
// @deprecated: Newer clients use logLogout. Kept for backward compatibility with cached clients.
export async function logAutoLogout(vendorId: number, vendorName: string) {
    console.warn(`[Deprecated] logAutoLogout called for ${vendorName}. Client might be using old version.`);
    await logLogout(vendorId, vendorName, 'AUTO');
}

export async function logLogout(vendorId: number, vendorName: string, type: 'AUTO' | 'MANUAL', userName?: string, vendorUserId?: number, sessionId?: string | null) {
    const action = type === 'AUTO' ? "AUTO_LOGOUT" : "LOGOUT";

    // Standardized Log Format: Target = [Company] [User]
    const target = `${vendorName} ${userName || '(担当者不明)'}`;

    let detail = "";
    if (type === 'AUTO') {
        detail = `自動ログアウト (無操作タイムアウト) (VendorID: ${vendorId}, UserID: ${vendorUserId ?? 'N/A'})`;
    } else {
        detail = `手動ログアウトボタン押下 (VendorID: ${vendorId}, UserID: ${vendorUserId ?? 'N/A'})`;
    }
    if (sessionId) {
        detail += ` [Session: ${sessionId}]`;
    }

    await logOperation(action, target, detail);
}

// Admin Login Logger
export async function logAdminLogin(email: string, sessionId?: string) {
    const detail = sessionId
        ? `Admin user logged in via credentials [Session: ${sessionId}]`
        : "Admin user logged in via credentials";
    await logOperation("ADMIN_LOGIN", `Admin: ${email}`, detail);
}


// 価格修正通知メール送信
async function sendPriceCorrectionNotification(
    transactionId: number,
    vendorName: string,
    itemName: string,
    oldPrice: number,
    newPrice: number,
    reason: string
) {
    const fromAddress = process.env.SMTP_FROM_ADDRESS;
    const adminEmails = process.env.ADMIN_EMAILS?.split(',').map(e => e.trim()).filter(Boolean);

    if (!fromAddress || !adminEmails?.length) {
        console.warn('SMTP_FROM_ADDRESS or ADMIN_EMAILS not set. Skipping price correction notification.');
        return;
    }

    const session = await getServerSession(authOptions);
    const correctedBy = session?.user?.email || '不明';

    const htmlContent = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #dc2626;">⚠️ 価格修正通知</h2>
            <p>以下の取引で価格が修正されました。</p>
            
            <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                <tr><td style="padding: 8px; background: #f3f4f6; font-weight: bold;">取引ID</td><td style="padding: 8px;">#${transactionId}</td></tr>
                <tr><td style="padding: 8px; background: #f3f4f6; font-weight: bold;">業者名</td><td style="padding: 8px;">${vendorName}</td></tr>
                <tr><td style="padding: 8px; background: #f3f4f6; font-weight: bold;">商品名</td><td style="padding: 8px;">${itemName}</td></tr>
                <tr><td style="padding: 8px; background: #f3f4f6; font-weight: bold;">変更前</td><td style="padding: 8px;">¥${oldPrice.toLocaleString()}</td></tr>
                <tr><td style="padding: 8px; background: #f3f4f6; font-weight: bold;">変更後</td><td style="padding: 8px; color: #dc2626; font-weight: bold;">¥${newPrice.toLocaleString()}</td></tr>
                <tr><td style="padding: 8px; background: #f3f4f6; font-weight: bold;">修正理由</td><td style="padding: 8px;">${reason}</td></tr>
                <tr><td style="padding: 8px; background: #f3f4f6; font-weight: bold;">修正者</td><td style="padding: 8px;">${correctedBy}</td></tr>
                <tr><td style="padding: 8px; background: #f3f4f6; font-weight: bold;">修正日時</td><td style="padding: 8px;">${new Date().toLocaleString('ja-JP')}</td></tr>
            </table>
            
            <p style="font-size: 0.9em; color: #666;">
                ※このメールは自動送信されています。
            </p>
        </div>
    `;

    // Get access token for Graph API
    const tenantId = process.env.AZURE_TENANT_ID;
    const clientId = process.env.AZURE_CLIENT_ID;
    const clientSecret = process.env.AZURE_CLIENT_SECRET;

    if (!tenantId || !clientId || !clientSecret) {
        console.warn('Azure AD credentials missing. Skipping email.');
        return;
    }

    const tokenEndpoint = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
    const params = new URLSearchParams();
    params.append('client_id', clientId);
    params.append('scope', 'https://graph.microsoft.com/.default');
    params.append('client_secret', clientSecret);
    params.append('grant_type', 'client_credentials');

    const tokenResponse = await fetch(tokenEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params,
    });

    if (!tokenResponse.ok) {
        throw new Error(`Token fetch failed: ${tokenResponse.statusText}`);
    }

    const { access_token } = await tokenResponse.json();

    const emailMessage = {
        message: {
            subject: `【価格修正】取引#${transactionId} - ${itemName}`,
            body: { contentType: "HTML", content: htmlContent },
            toRecipients: adminEmails.map(email => ({ emailAddress: { address: email } })),
        },
        saveToSentItems: false,
    };

    const sendMailEndpoint = `https://graph.microsoft.com/v1.0/users/${fromAddress}/sendMail`;

    const response = await fetch(sendMailEndpoint, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${access_token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(emailMessage),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Graph API Error: ${response.status} - ${errorText}`);
    }

    console.log(`Price correction notification sent to ${adminEmails.join(', ')}`);
}
// 指定した取引IDに対する返品済み数量（個数単位）を取得
export async function getReturnedQuantities(transactionId: number) {
    // InventoryLogのreasonに "元取引#{id}" が含まれているログを集計
    // これが最も確実（過去データ含め）
    const logs = await prisma.inventoryLog.findMany({
        where: {
            type: '入庫',
            reason: { contains: `元取引#${transactionId}` }
        }
    });

    const returnedMap: Record<number, number> = {};
    for (const log of logs) {
        returnedMap[log.productId] = (returnedMap[log.productId] || 0) + log.quantity;
    }
    return returnedMap;
}

// =========================================
// SystemConfig (システム設定)
// =========================================

export async function getSystemConfig(key: string): Promise<string> {
    const config = await prisma.systemConfig.findUnique({ where: { key } });
    return config?.value || "";
}

export async function setSystemConfig(key: string, value: string): Promise<void> {
    await prisma.systemConfig.upsert({
        where: { key },
        create: { key, value },
        update: { value },
    });
    revalidatePath('/admin/settings');
}

// ===== 月次締め =====

export async function isMonthClosed(year: number, month: number): Promise<boolean> {
    const record = await prisma.monthlyClose.findUnique({
        where: { year_month: { year, month } },
    });
    return !!record;
}

export async function getMonthlyCloseInfo(year: number, month: number) {
    return prisma.monthlyClose.findUnique({
        where: { year_month: { year, month } },
    });
}

export async function closeMonth(year: number, month: number, closedBy?: string, status: string = 'DRAFT') {
    return prisma.monthlyClose.create({
        data: { year, month, closedBy, status },
    });
}

export async function finalizeMonth(year: number, month: number, closedBy?: string) {
    return prisma.monthlyClose.update({
        where: { year_month: { year, month } },
        data: { status: 'FINAL', closedBy, closedAt: new Date() },
    });
}

export async function reopenMonth(year: number, month: number) {
    return prisma.monthlyClose.delete({
        where: { year_month: { year, month } },
    });
}

export async function checkTransactionMonthClosed(transactionDate: Date): Promise<boolean> {
    // JSTで判定
    const jstDate = new Date(transactionDate.getTime() + 9 * 60 * 60 * 1000);
    const year = jstDate.getUTCFullYear();
    const month = jstDate.getUTCMonth() + 1;
    return isMonthClosed(year, month);
}

// ===== 月次明細書 =====

export type StatementItem = {
    date: string;
    txId: number;
    code: string;
    name: string;
    quantity: number;
    unit: string;
    unitPrice: number;
    subtotal: number;
    isReturn: boolean;
};

export type AirconStatementItem = {
    date: string;
    logId: number;
    managementNo: string;
    modelNumber: string;
    capacity: string;
    type: string;
    unitPrice: number;
    isReturn: boolean;
};

export type VendorStatement = {
    vendorId: number;
    vendorName: string;
    priceTier: string;
    materialItems: StatementItem[];
    materialTotal: number;
    airconItems: AirconStatementItem[];
    airconTotal: number;
};

export async function getMonthlyStatements(year: number, month: number): Promise<VendorStatement[]> {
    // 月の開始・終了日（UTC）
    const startDate = new Date(Date.UTC(year, month - 1, 1));
    const endDate = new Date(Date.UTC(year, month, 1));

    // 1. 全取引を取得
    const transactions = await prisma.transaction.findMany({
        where: {
            date: { gte: startDate, lt: endDate },
        },
        include: { vendor: true, vendorUser: true },
        orderBy: { date: 'asc' },
    });

    // 2. 全エアコンログを取得（買取分のみ：貸出・返品は除外）
    const airconLogs = await prisma.airConditionerLog.findMany({
        where: {
            createdAt: { gte: startDate, lt: endDate },
            isTemporaryLoan: false,
            managementNo: null, // 管理No付き＝貸出品は除外、買取のみ
        },
        include: {
            vendor: true,
            vendorUser: true,
            airconProduct: true,
        },
        orderBy: { createdAt: 'asc' },
    });

    // 3. 業者別に集計
    const vendorMap = new Map<number, VendorStatement>();

    const getOrCreateVendor = (vendorId: number, vendorName: string, priceTier: string) => {
        if (!vendorMap.has(vendorId)) {
            vendorMap.set(vendorId, {
                vendorId,
                vendorName,
                priceTier,
                materialItems: [],
                materialTotal: 0,
                airconItems: [],
                airconTotal: 0,
            });
        }
        return vendorMap.get(vendorId)!;
    };

    // 材料取引を集計
    for (const tx of transactions) {
        const vendor = getOrCreateVendor(tx.vendorId, tx.vendor.name, tx.vendor.priceTier);
        let items: any[] = [];
        try { items = JSON.parse(tx.items); } catch { continue; }

        for (const item of items) {
            const effectiveQty = (item.isBox && item.quantityPerBox)
                ? item.quantity * item.quantityPerBox
                : item.quantity;
            const subtotal = item.price * item.quantity;

            vendor.materialItems.push({
                date: tx.date.toISOString().slice(0, 10),
                txId: tx.id,
                code: item.code || '-',
                name: item.name || '不明',
                quantity: effectiveQty,
                unit: item.unit || '個',
                unitPrice: (item.isBox && item.quantityPerBox)
                    ? Math.round(subtotal / effectiveQty)
                    : item.price,
                subtotal,
                isReturn: effectiveQty < 0,
            });
            vendor.materialTotal += subtotal;
        }
    }

    // エアコンログを集計
    // 買取品の価格はProductテーブル（材料管理側）から取得
    // AirconProduct.capacity → Product.code (RSAJ{22,25,28,36}) のマッピング
    const airconProducts = await prisma.product.findMany({
        where: { code: { startsWith: 'RSAJ' } },
        select: { code: true, priceA: true, priceB: true },
    });
    // 容量文字列 → Product価格のマップ (例: "2.2kW" → { priceA: 44000, priceB: 40000 })
    const capacityPriceMap = new Map<string, { priceA: number; priceB: number }>();
    for (const ap of airconProducts) {
        // RSAJ22 → 2.2, RSAJ25 → 2.5, RSAJ28 → 2.8, RSAJ36 → 3.6
        const num = ap.code.replace('RSAJ', '');
        const kw = `${num.slice(0, -1)}.${num.slice(-1)}kW`;
        capacityPriceMap.set(kw, { priceA: ap.priceA, priceB: ap.priceB });
    }

    for (const log of airconLogs) {
        const vendor = getOrCreateVendor(log.vendorId, log.vendor.name, log.vendor.priceTier);

        // 価格決定: Productテーブル（材料管理）を優先、なければAirconProductにフォールバック
        let price = 0;
        const capacity = log.airconProduct?.capacity || '';
        const productPrice = capacityPriceMap.get(capacity);
        if (productPrice) {
            price = vendor.priceTier === 'B' ? productPrice.priceB : productPrice.priceA;
        } else if (log.airconProduct) {
            price = vendor.priceTier === 'B' ? log.airconProduct.priceB : log.airconProduct.priceA;
        }

        // 返品はマイナス
        const effectivePrice = log.isReturned ? 0 : price;

        vendor.airconItems.push({
            date: log.createdAt.toISOString().slice(0, 10),
            logId: log.id,
            managementNo: log.managementNo || '-',
            modelNumber: log.modelNumber,
            capacity: log.airconProduct?.capacity || '-',
            type: log.type,
            unitPrice: effectivePrice,
            isReturn: log.isReturned,
        });
        vendor.airconTotal += effectivePrice;
    }

    // 取引のある業者のみ返す（業者名順）
    return Array.from(vendorMap.values())
        .filter(v => v.materialItems.length > 0 || v.airconItems.length > 0)
        .sort((a, b) => a.vendorName.localeCompare(b.vendorName, 'ja'));
}
