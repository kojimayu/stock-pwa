import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type CartItem = {
    productId: number;
    code?: string;
    name: string;
    price: number;
    quantity: number;
    isManual?: boolean;
    isBox?: boolean;
    quantityPerBox?: number;
    manufacturer?: string;
    unit?: string;
    category?: string;
    subCategory?: string;
};

export type Vendor = {
    id: number;
    name: string;
    accessCompanyName?: string | null;
};

export type VendorUser = {
    id: number;
    name: string;
    pinChanged?: boolean;
};

// ピッキングリスト用のアイテム型
export type PickingItem = {
    productId: number;
    code?: string;
    name: string;
    quantity: number;
    unit?: string;
    category?: string;
    subCategory?: string;
    picked: boolean;
    expectedStock?: number;  // 持出し後の期待在庫数（requireStockCheck商品のみ）
};

// 一時保存セッションの型
export type PausedSession = {
    vendor: Vendor;
    vendorUser: VendorUser | null;
    sessionId: string | null;
    items: CartItem[];
    pausedAt: string; // ISO string
};

type CartState = {
    vendor: Vendor | null;
    vendorUser: VendorUser | null;
    sessionId: string | null;
    items: CartItem[];
    isProxyMode: boolean;
    isReturnMode: boolean;
    transactionDate: Date | null;
    setVendor: (vendor: Vendor | null) => void;
    setVendorUser: (vendorUser: VendorUser | null) => void;
    setSessionId: (sessionId: string | null) => void;
    setProxyMode: (isProxy: boolean) => void;
    setReturnMode: (isReturn: boolean) => void;
    setTransactionDate: (date: Date | null) => void;
    addItem: (item: Omit<CartItem, "quantity"> & { quantity?: number }) => void;
    removeItem: (productId: number, isBox?: boolean) => void;
    updateQuantity: (productId: number, quantity: number, isBox?: boolean) => void;
    clearCart: () => void;
    clearSession: () => void;
    getTotalPrice: () => number;
    getTotalItems: () => number;
    pauseSession: () => void;
    resumeSession: (vendorId: number) => boolean;
};

// ---- ピッキングリスト用ヘルパー ----
const PICKING_STORAGE_KEY = 'kiosk-picking-items';

/** 出庫確定後の商品リストをlocalStorageに保存 */
export function savePickingItems(items: PickingItem[]) {
    if (typeof window === 'undefined') return;
    localStorage.setItem(PICKING_STORAGE_KEY, JSON.stringify(items));
}

/** ピッキングリストをlocalStorageから読み取り */
export function loadPickingItems(): PickingItem[] | null {
    if (typeof window === 'undefined') return null;
    const data = localStorage.getItem(PICKING_STORAGE_KEY);
    if (!data) return null;
    try {
        return JSON.parse(data);
    } catch {
        return null;
    }
}

/** ピッキングリストをlocalStorageから削除 */
export function clearPickingItems() {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(PICKING_STORAGE_KEY);
}

// ---- 一時保存セッション用ヘルパー ----
const PAUSED_SESSIONS_KEY = 'kiosk-paused-sessions';

function getPausedSessions(): PausedSession[] {
    if (typeof window === 'undefined') return [];
    const data = localStorage.getItem(PAUSED_SESSIONS_KEY);
    if (!data) return [];
    try {
        return JSON.parse(data);
    } catch {
        return [];
    }
}

function savePausedSessions(sessions: PausedSession[]) {
    if (typeof window === 'undefined') return;
    localStorage.setItem(PAUSED_SESSIONS_KEY, JSON.stringify(sessions));
}

/** 一時保存されたセッション一覧を取得 */
export function getStoredPausedSessions(): PausedSession[] {
    return getPausedSessions();
}

/** 指定業者IDの一時保存セッションを削除 */
export function discardPausedSession(vendorId: number) {
    const sessions = getPausedSessions();
    savePausedSessions(sessions.filter(s => s.vendor.id !== vendorId));
}

export const useCartStore = create<CartState>()(
    persist(
        (set, get) => ({
            vendor: null,
            vendorUser: null,
            sessionId: null,
            items: [],
            isProxyMode: false,
            isReturnMode: false,
            transactionDate: null,
            setVendor: (vendor) => set({ vendor }),
            setVendorUser: (vendorUser) => set({ vendorUser }),
            setSessionId: (sessionId) => set({ sessionId }),
            setProxyMode: (isProxyMode) => set({ isProxyMode }),
            setReturnMode: (isReturnMode) => set({ isReturnMode }),
            setTransactionDate: (transactionDate) => set({ transactionDate }),
            addItem: (newItem) =>
                set((state) => {
                    const existing = state.items.find((i) => {
                        if (newItem.isManual && i.isManual) {
                            return i.name === newItem.name && i.price === newItem.price;
                        }
                        return i.productId === newItem.productId && i.isBox === newItem.isBox;
                    });

                    if (existing) {
                        return {
                            items: state.items.map((i) => {
                                const isMatch = newItem.isManual && i.isManual
                                    ? i.name === newItem.name && i.price === newItem.price
                                    : i.productId === newItem.productId && i.isBox === newItem.isBox;

                                return isMatch
                                    ? { ...i, quantity: i.quantity + (newItem.quantity || 1) }
                                    : i;
                            }),
                        };
                    }
                    return { items: [...state.items, { ...newItem, quantity: newItem.quantity || 1 }] };
                }),
            removeItem: (productId, isBox) =>
                set((state) => ({
                    items: state.items.filter((i) => !(i.productId === productId && i.isBox === isBox)),
                })),
            updateQuantity: (productId, quantity, isBox) =>
                set((state) => {
                    if (quantity <= 0) {
                        return { items: state.items.filter((i) => !(i.productId === productId && i.isBox === isBox)) };
                    }
                    return {
                        items: state.items.map((i) =>
                            i.productId === productId && i.isBox === isBox ? { ...i, quantity } : i
                        ),
                    };
                }),
            clearCart: () => set({ items: [] }),
            clearSession: () => set({ vendor: null, vendorUser: null, sessionId: null, items: [], isProxyMode: false, isReturnMode: false, transactionDate: null }),
            getTotalPrice: () => get().items.reduce((sum, item) => sum + item.price * item.quantity, 0),
            getTotalItems: () => get().items.reduce((sum, item) => sum + item.quantity, 0),

            // 一時保存：現在のカートをlocalStorageに退避
            pauseSession: () => {
                const { vendor, vendorUser, sessionId, items } = get();
                if (!vendor || items.length === 0) return;

                const sessions = getPausedSessions();
                // 同一業者の既存セッションがあれば上書き
                const filtered = sessions.filter(s => s.vendor.id !== vendor.id);
                filtered.push({
                    vendor,
                    vendorUser,
                    sessionId,
                    items,
                    pausedAt: new Date().toISOString(),
                });
                savePausedSessions(filtered);

                // 現在のカートをクリア（セッション情報は残さない）
                set({ vendor: null, vendorUser: null, sessionId: null, items: [], isProxyMode: false, isReturnMode: false, transactionDate: null });
            },

            // 一時保存セッションを復元
            resumeSession: (vendorId: number) => {
                const sessions = getPausedSessions();
                const target = sessions.find(s => s.vendor.id === vendorId);
                if (!target) return false;

                // 復元
                set({
                    vendor: target.vendor,
                    vendorUser: target.vendorUser,
                    sessionId: target.sessionId,
                    items: target.items,
                    isProxyMode: false,
                    isReturnMode: false,
                    transactionDate: null,
                });

                // 一時保存から削除
                savePausedSessions(sessions.filter(s => s.vendor.id !== vendorId));
                return true;
            },
        }),
        {
            name: 'kiosk-cart-storage',
        }
    )
);
