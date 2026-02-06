'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

export type LoginState = {
    message?: string;
    success?: boolean;
};

// Helper for Logging
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

async function logOperation(action: string, target: string, details?: string) {
    try {
        const session = await getServerSession(authOptions);
        const executor = session?.user?.email || "System/Guest";

        await prisma.operationLog.create({
            data: {
                action,
                target,
                details: `${details || ''} [By: ${executor}]`, // Append executor to details
            },
        });
    } catch (e) {
        console.error("Failed to create operation log:", e);
        // Logging failure should not block the main action
    }
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

// 管理画面用（全業者）
export async function getAllVendors() {
    const vendors = await prisma.vendor.findMany({
        include: {
            _count: {
                select: { transactions: true }
            }
        },
        orderBy: { name: 'asc' }
    });
    return vendors;
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

            // 新規作成（isActive: false, 初期PIN: 1234）
            await prisma.vendor.create({
                data: {
                    name: av.name,
                    pinCode: '1234',
                    pinChanged: false,
                    isActive: false,  // 初期は無効（管理者が有効化）
                    accessCompanyName: av.name
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

    return {
        categories: categories.map(c => c.category),
        subCategories: subCategories.map(c => c.subCategory).filter(Boolean) as string[],
        suppliers: suppliers.map(c => c.supplier).filter(Boolean) as string[],
    };
}

export async function upsertVendor(data: { id?: number; name: string; pinCode: string; email?: string | null; accessCompanyName?: string | null; showPriceInEmail?: boolean }) {
    if (data.id) {
        // Update
        await prisma.vendor.update({
            where: { id: data.id },
            data: {
                name: data.name,
                pinCode: data.pinCode,
                email: data.email,
                accessCompanyName: data.accessCompanyName,
                showPriceInEmail: data.showPriceInEmail ?? true,
            },
        });
        await logOperation("VENDOR_UPDATE", `Vendor: ${data.name} (ID: ${data.id})`, `Updated profile. AccessLink: ${data.accessCompanyName || 'None'}`);
    } else {
        // Create
        const newVendor = await prisma.vendor.create({
            data: {
                name: data.name,
                pinCode: data.pinCode,
                email: data.email,
                accessCompanyName: data.accessCompanyName,
                showPriceInEmail: data.showPriceInEmail ?? true,
            },
        });
        await logOperation("VENDOR_CREATE", `Vendor: ${data.name}`, `Created new vendor. AccessLink: ${data.accessCompanyName || 'None'}`);
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

    await logOperation("VENDOR_DELETE", `Vendor: ${vendor?.name || id}`, `Deleted vendor`);
    revalidatePath('/admin/vendors');
}

export async function verifyPin(vendorId: string | number, pin: string) {
    const vendor = await prisma.vendor.findUnique({
        where: { id: Number(vendorId) },
    });

    if (!vendor) {
        return { success: false, message: '業者が存在しません' };
    }

    if (vendor.pinCode !== pin) {
        return { success: false, message: 'PINコードが正しくありません' };
    }

    // pinChangedフラグも返す
    return { success: true, vendor, pinChanged: vendor.pinChanged };
}

export async function loginByPin(pin: string) {
    const vendor = await prisma.vendor.findFirst({
        where: { pinCode: pin },
    });

    if (!vendor) {
        return { success: false, message: 'PINコードが無効です' };
    }

    return { success: true, vendor, pinChanged: vendor.pinChanged };
}

// PINコードを変更
export async function changePin(vendorId: number, newPin: string) {
    // 4桁の数字のみ許可
    if (!/^\d{4}$/.test(newPin)) {
        return { success: false, message: 'PINは4桁の数字で入力してください' };
    }

    // 初期PIN（1234）は設定不可
    if (newPin === '1234') {
        return { success: false, message: '初期PIN(1234)は使用できません' };
    }

    // 重複チェック
    const existing = await prisma.vendor.findFirst({
        where: { pinCode: newPin },
    });
    if (existing && existing.id !== vendorId) {
        return { success: false, message: 'このPINは既に使用されています' };
    }

    const vendor = await prisma.vendor.update({
        where: { id: vendorId },
        data: { pinCode: newPin, pinChanged: true },
    });

    await logOperation("VENDOR_PIN_CHANGE", `Vendor: ${vendor.name}`, `PIN changed`);
    return { success: true, vendor };
}

// PINコードをリセット（管理者用）
export async function resetPin(vendorId: number) {
    const vendor = await prisma.vendor.update({
        where: { id: vendorId },
        data: { pinCode: '1234', pinChanged: false },
    });

    await logOperation("VENDOR_PIN_RESET", `Vendor: ${vendor.name}`, `PIN reset to 1234`);
    revalidatePath('/admin/vendors');
    return { success: true };
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
export async function getProducts() {
    return await prisma.product.findMany({
        orderBy: [
            { usageCount: 'desc' },
            { code: 'asc' }
        ],
    });
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
}) {
    // Validation
    // Skip profit check if price is 0 (e.g. initial registration without price)
    if (data.priceA > 0 && data.cost >= data.priceA) throw new Error(`売価A(${data.priceA})が仕入れ値(${data.cost})を下回っています`);
    if (data.priceB > 0 && data.cost >= data.priceB) throw new Error(`売価B(${data.priceB})が仕入れ値(${data.cost})を下回っています`);
    if (data.priceC > 0 && data.cost >= data.priceC) throw new Error(`売価C(${data.priceC})が仕入れ値(${data.cost})を下回っています`);

    const normalizedCode = normalizeCode(data.code);

    if (data.id) {
        // Update
        // 在庫数の変更を許可する
        // 原価(cost)が0の場合は更新しない（消失防止）

        const updateData: any = {
            code: normalizedCode,
            name: data.name,
            category: data.category,
            subCategory: data.subCategory,
            productType: data.productType,
            priceA: data.priceA,
            priceB: data.priceB,
            priceC: data.priceC,
            minStock: data.minStock,
            supplier: data.supplier,
            color: data.color,
            unit: data.unit ?? "個",
            stock: data.stock !== undefined ? data.stock : undefined, // stockがundefinedなら更新しない
        };

        // costが0より大きい場合のみ更新
        if (data.cost > 0) {
            updateData.cost = data.cost;
        }

        await prisma.product.update({
            where: { id: data.id },
            data: updateData,
        });

        // ログ: 原価と在庫の変更を記録
        const logDetail = `PriceA: ${data.priceA}, Cost: ${data.cost > 0 ? data.cost : '(unchanged)'}, Stock: ${data.stock ?? '(unchanged)'}`;
        await logOperation("PRODUCT_UPDATE", `Product: ${normalizedCode}`, logDetail);
    } else {
        // Create
        // Check if code exists (for manual creation safety)
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
                priceA: data.priceA,
                priceB: data.priceB,
                priceC: data.priceC,
                minStock: data.minStock,
                cost: data.cost,
                stock: data.stock ?? 0,
                supplier: data.supplier,
                color: data.color,
                unit: data.unit ?? "個",
            },
        });
        await logOperation("PRODUCT_CREATE", `Product: ${normalizedCode}`, `Created new product`);
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

export async function importProducts(products: {
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

        // 2. Execution Phase
        await prisma.$transaction(async (tx) => {
            for (const p of products) {
                const normalizedCode = normalizeCode(p.code);

                // Allow bulk update of prices
                const existing = await tx.product.findUnique({
                    where: { code: normalizedCode },
                });

                if (existing) {
                    await tx.product.update({
                        where: { code: normalizedCode },
                        data: {
                            name: p.name,
                            category: p.category,
                            subCategory: p.subCategory || "その他", // Default value
                            productType: p.productType || null,
                            priceA: p.priceA,
                            priceB: p.priceB,
                            priceC: p.priceC,
                            minStock: p.minStock,
                            cost: p.cost,
                            supplier: p.supplier,
                            color: p.color,
                            unit: p.unit ?? "個",
                        },
                    });
                } else {
                    await tx.product.create({
                        data: {
                            code: normalizedCode,
                            name: p.name,
                            category: p.category,
                            subCategory: p.subCategory || "その他", // Default value
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
                        },
                    });
                }
            }
        });

        await logOperation("IMPORT", "Batch Import", `Imported/Updated ${products.length} products`);
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

    await logOperation("PRODUCT_DELETE", `Product: ${product?.code || id}`, `Deleted ${product?.name}`);
    revalidatePath('/admin/products');
}

export async function adjustStock(productId: number, type: string, quantity: number, reason: string) {
    // Transactional update
    await prisma.$transaction(async (tx) => {
        // 1. Create Log
        await tx.inventoryLog.create({
            data: {
                productId,
                type,
                quantity,
                reason,
            },
        });

        // 2. Update Product Stock
        await tx.product.update({
            where: { id: productId },
            data: {
                stock: {
                    increment: quantity,
                },
            },
        });
    });
    revalidatePath('/admin/products');
}

// Dashboard Actions
export async function getTransactions(limit = 100) {
    const transactions = await prisma.transaction.findMany({
        take: limit,
        orderBy: { date: 'desc' },
        include: {
            vendor: true,
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
    items: { productId: number; quantity: number; price: number; name: string; isManual?: boolean }[],
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
            // Create Transaction Record
            const transaction = await tx.transaction.create({
                data: {
                    vendorId,
                    items: JSON.stringify(items), // Store detailed items as JSON
                    totalAmount,
                    hasUnregisteredItems, // Set flag
                    date: transactionDate ?? new Date(),  // 指定された日付または現在日時
                    isProxyInput,  // 代理入力フラグ
                },
            });

            // Update Stock for each item
            for (const item of items) {
                // Skip stock management for manual items
                if (item.isManual) continue;

                // Check current stock first (optional, but good for safety)
                const product = await tx.product.findUnique({ where: { id: item.productId } });
                if (!product || product.stock < item.quantity) {
                    throw new Error(`商品ID ${item.productId} の在庫が不足しています`);
                }

                // Decrease Stock
                await tx.product.update({
                    where: { id: item.productId },
                    data: {
                        stock: { decrement: item.quantity },
                        usageCount: { increment: item.quantity }
                    },
                });

                // Create Inventory Log
                await tx.inventoryLog.create({
                    data: {
                        productId: item.productId,
                        type: '出庫',
                        quantity: -item.quantity, // Negative for outflow
                        reason: `Transaction #${transaction.id}`,
                    },
                });
            }

            return transaction;
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
        return { success: true };
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
            // 1. Fetch Transaction
            const transaction = await tx.transaction.findUnique({
                where: { id: transactionId }
            });

            if (!transaction) throw new Error("取引が見つかりません");
            if (transaction.isReturned) throw new Error("既に戻し処理済みです");

            // 2. Parse Items
            const items = JSON.parse(transaction.items) as { productId: number; quantity: number; isManual?: boolean }[];

            // 3. Loop items and restore stock
            for (const item of items) {
                if (item.isManual) continue; // Skip manual items

                // Restore stock
                await tx.product.update({
                    where: { id: item.productId },
                    data: { stock: { increment: item.quantity } }
                });

                // Create Inventory Log
                await tx.inventoryLog.create({
                    data: {
                        productId: item.productId,
                        type: '返品',
                        quantity: item.quantity, // Positive for inflow
                        reason: `Transaction #${transaction.id} Return`,
                    }
                });
            }

            // 4. Mark Transaction as Returned
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
                where: { id: transactionId }
            });

            if (!transaction) throw new Error("取引が見つかりません");
            if (transaction.isReturned) throw new Error("既に戻し処理済みです");

            let items = JSON.parse(transaction.items) as { productId: number; quantity: number; price: number; name: string; isManual?: boolean }[];
            let totalAmount = transaction.totalAmount;
            let returnedAny = false;

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
                await tx.product.update({
                    where: { id: item.productId },
                    data: { stock: { increment: returnItem.returnQuantity } }
                });

                // 2. Log
                await tx.inventoryLog.create({
                    data: {
                        productId: item.productId,
                        type: '返品',
                        quantity: returnItem.returnQuantity,
                        reason: `Tx #${transactionId} Partial Return`,
                    }
                });

                // 3. Update Transaction Item (Decrease quantity locally)
                const deduction = item.price * returnItem.returnQuantity;
                totalAmount -= deduction;

                items[itemIndex].quantity -= returnItem.returnQuantity;
                returnedAny = true;
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

// Operation Logs
export async function getOperationLogs(limit = 100) {
    return await prisma.operationLog.findMany({
        take: limit,
        orderBy: { performedAt: 'desc' },
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
    // 1. Snapshot current stock as 'expectedStock'
    const products = await prisma.product.findMany();

    // Create session
    const inventory = await prisma.inventoryCount.create({
        data: {
            status: 'IN_PROGRESS',
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

    await logOperation("INVENTORY_START", `Inventory #${inventory.id}`, `Started inventory count`);
    revalidatePath('/admin/inventory');
    return inventory;
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

export async function updateInventoryItem(itemId: number, actualStock: number) {
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
        }
    });

    // No log here, only on finalize
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

        await logOperation("INVENTORY_FINALIZE", `Inventory #${id}`, `Finalized inventory count`);
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

    await logOperation("INVENTORY_CANCEL", `Inventory #${id}`, `Cancelled inventory count`);
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
    // 1. Get products low on stock (stock < minStock)
    const lowStockProducts = await prisma.product.findMany({
        where: {
            stock: {
                lt: prisma.product.fields.minStock
            },
            minStock: {
                gt: 0
            }
        }
    });

    if (lowStockProducts.length === 0) {
        return { success: false, message: "基準在庫を下回っている商品はありません。" };
    }

    // 2. Group by supplier
    const groupedBySupplier = lowStockProducts.reduce((acc, p) => {
        const supplier = p.supplier || "未指定";
        if (!acc[supplier]) acc[supplier] = [];
        acc[supplier].push(p);
        return acc;
    }, {} as Record<string, typeof lowStockProducts>);

    // 3. Create Draft Orders
    let createdCount = 0;
    for (const [supplier, products] of Object.entries(groupedBySupplier)) {
        await prisma.order.create({
            data: {
                supplier,
                status: 'DRAFT',
                items: {
                    create: products.map(p => ({
                        productId: p.id,
                        quantity: Math.max(0, p.minStock - p.stock + 1), // Default: refill to minStock + 1
                        cost: p.cost,
                    }))
                }
            }
        });
        createdCount++;
    }

    await logOperation("ORDER_DRAFT_GENERATE", `Generated ${createdCount} draft orders`, `Target products: ${lowStockProducts.length}`);
    revalidatePath('/admin/orders');
    return { success: true, message: `${createdCount}件の発注候補を作成しました。` };
}

export async function confirmOrder(id: number) {
    await prisma.order.update({
        where: { id },
        data: { status: 'ORDERED' }
    });
    await logOperation("ORDER_CONFIRM", `Order #${id}`, `Status changed to ORDERED`);
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

    // 2. Update item
    const newReceivedQty = item.receivedQuantity + quantity;
    await prisma.orderItem.update({
        where: { id: orderItemId },
        data: {
            receivedQuantity: newReceivedQty,
            isReceived: newReceivedQty >= item.quantity
        }
    });

    // 3. Increase stock
    await prisma.product.update({
        where: { id: item.productId },
        data: { stock: { increment: quantity } }
    });

    // 4. Record Log
    await prisma.inventoryLog.create({
        data: {
            productId: item.productId,
            type: 'RESTOCK',
            quantity: quantity,
            reason: `Order #${item.orderId} Received`,
        }
    });

    // 5. Check order status
    const allItems = await prisma.orderItem.findMany({
        where: { orderId: item.orderId }
    });
    const allDone = allItems.every(i => i.isReceived);

    await prisma.order.update({
        where: { id: item.orderId },
        data: {
            status: allDone ? 'RECEIVED' : 'PARTIAL',
            updatedAt: new Date()
        }
    });

    await logOperation("ORDER_ITEM_RECEIVE", `Order #${item.orderId} Item`, `Product: ${item.product.name}, Qty: ${quantity}`);
    revalidatePath('/admin/orders');
    revalidatePath(`/admin/orders/${item.orderId}`);
    revalidatePath('/admin/products');
}

export async function deleteOrder(id: number) {
    const order = await prisma.order.findUnique({ where: { id } });
    if (order?.status !== 'DRAFT') throw new Error("Draft以外の発注書は削除できません");

    await prisma.orderItem.deleteMany({ where: { orderId: id } });
    await prisma.order.delete({ where: { id } });

    await logOperation("ORDER_DELETE", `Order #${id}`, `Deleted draft order`);
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

    await logOperation("ORDER_RECEIVE_CANCEL", `Order #${item.orderId}`, `Cancelled receipt for ${item.product.name}`);
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
    await logOperation("ORDER_CREATE", `Order #${order.id}`, `Created manual order for ${supplier}`);
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
