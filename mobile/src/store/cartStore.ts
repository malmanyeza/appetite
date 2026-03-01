import { create } from 'zustand';

interface CartItem {
    id: string;
    name: string;
    price: number;
    qty: number;
    image_url?: string;
    restaurant_id: string;
}

interface CartState {
    items: CartItem[];
    addItem: (item: any, restaurantId: string) => void;
    removeItem: (id: string) => void;
    updateQty: (id: string, delta: number) => void;
    clearCart: () => void;
    total: number;
}

export const useCartStore = create<CartState>((set, get) => ({
    items: [],
    total: 0,

    addItem: (item, restaurantId) => {
        const currentItems = get().items;

        // If adding from a different restaurant, clear cart first (standard UX)
        if (currentItems.length > 0 && currentItems[0].restaurant_id !== restaurantId) {
            const newItem = { ...item, qty: 1, restaurant_id: restaurantId };
            set({ items: [newItem], total: item.price });
            return;
        }

        const existing = currentItems.find(i => i.id === item.id);
        let newItems;
        if (existing) {
            newItems = currentItems.map(i => i.id === item.id ? { ...i, qty: i.qty + 1 } : i);
        } else {
            newItems = [...currentItems, { ...item, qty: 1, restaurant_id: restaurantId }];
        }
        set({ items: newItems, total: newItems.reduce((sum, i) => sum + (i.price * i.qty), 0) });
    },

    removeItem: (id) => {
        const newItems = get().items.filter(i => i.id !== id);
        set({ items: newItems, total: newItems.reduce((sum, i) => sum + (i.price * i.qty), 0) });
    },

    updateQty: (id, delta) => {
        const newItems = get().items.map(i => {
            if (i.id === id) {
                const newQty = Math.max(0, i.qty + delta);
                return { ...i, qty: newQty };
            }
            return i;
        }).filter(i => i.qty > 0);
        set({ items: newItems, total: newItems.reduce((sum, i) => sum + (i.price * i.qty), 0) });
    },

    clearCart: () => set({ items: [], total: 0 }),
}));
