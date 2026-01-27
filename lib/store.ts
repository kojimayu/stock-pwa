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

type CartState = {
    vendor: Vendor | null;
    items: CartItem[];
    setVendor: (vendor: Vendor | null) => void;
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
            items: [],
            setVendor: (vendor) => set({ vendor }),
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
            clearSession: () => set({ vendor: null, items: [] }),
        }),
        {
            name: 'kiosk-cart-storage',
        }
    )
);
