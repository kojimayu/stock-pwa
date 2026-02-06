import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type CartItem = {
    productId: number;
    name: string;
    price: number;
    quantity: number;
    isManual?: boolean;
};

export type Vendor = {
    id: number;
    name: string;
};

export type VendorUser = {
    id: number;
    name: string;
    pinChanged?: boolean;
};

type CartState = {
    vendor: Vendor | null;
    vendorUser: VendorUser | null;
    items: CartItem[];
    isProxyMode: boolean; // 代理入力モードフラグ
    transactionDate: Date | null; // 代理入力用：引取日
    setVendor: (vendor: Vendor | null) => void;
    setVendorUser: (vendorUser: VendorUser | null) => void;
    setProxyMode: (isProxy: boolean) => void;
    setTransactionDate: (date: Date | null) => void;
    addItem: (item: Omit<CartItem, "quantity"> & { quantity?: number }) => void;
    removeItem: (productId: number) => void;
    updateQuantity: (productId: number, quantity: number) => void;
    clearCart: () => void;
    clearSession: () => void;
};

export const useCartStore = create<CartState>()(
    persist(
        (set) => ({
            vendor: null,
            vendorUser: null,
            items: [],
            isProxyMode: false,
            transactionDate: null,
            setVendor: (vendor) => set({ vendor }),
            setVendorUser: (vendorUser) => set({ vendorUser }),
            setProxyMode: (isProxyMode) => set({ isProxyMode }),
            setTransactionDate: (transactionDate) => set({ transactionDate }),
            addItem: (newItem) =>
                set((state) => {
                    const existing = state.items.find((i) => {
                        if (newItem.isManual && i.isManual) {
                            return i.name === newItem.name && i.price === newItem.price;
                        }
                        return i.productId === newItem.productId;
                    });

                    if (existing) {
                        return {
                            items: state.items.map((i) => {
                                const isMatch = newItem.isManual && i.isManual
                                    ? i.name === newItem.name && i.price === newItem.price
                                    : i.productId === newItem.productId;

                                return isMatch
                                    ? { ...i, quantity: i.quantity + (newItem.quantity || 1) }
                                    : i;
                            }),
                        };
                    }
                    return { items: [...state.items, { ...newItem, quantity: newItem.quantity || 1 }] };
                }),
            removeItem: (productId) =>
                set((state) => ({
                    items: state.items.filter((i) => i.productId !== productId),
                })),
            updateQuantity: (productId, quantity) =>
                set((state) => {
                    if (quantity <= 0) {
                        return { items: state.items.filter((i) => i.productId !== productId) };
                    }
                    return {
                        items: state.items.map((i) =>
                            i.productId === productId ? { ...i, quantity } : i
                        ),
                    };
                }),
            clearCart: () => set({ items: [] }),
            clearSession: () => set({ vendor: null, vendorUser: null, items: [], isProxyMode: false, transactionDate: null }),
        }),
        {
            name: 'kiosk-cart-storage',
        }
    )
);
