import { create } from 'zustand';

interface CartItem {
    id: string; // This will now be a composite key: menu_item_id + hash(extras)
    menu_item_id: string;
    name: string;
    price: number;
    qty: number;
    image_url?: string;
    restaurant_id: string;
    location_id: string;
    selected_add_ons: { name: string; price: number }[];
}

interface CartState {
    items: CartItem[];
    fulfillmentType: 'delivery' | 'pickup' | null;
    hasChosenFulfillment: boolean;
    addItem: (item: any, restaurantId: string, locationId: string, selectedAddOns?: { name: string, price: number }[]) => void;
    setFulfillmentType: (type: 'delivery' | 'pickup') => void;
    removeItem: (id: string) => void;
    updateQty: (id: string, delta: number) => void;
    clearCart: () => void;
    total: number;
}

export const useCartStore = create<CartState>((set, get) => ({
    items: [],
    total: 0,
    fulfillmentType: null,
    hasChosenFulfillment: false,

    setFulfillmentType: (type) => set({ fulfillmentType: type, hasChosenFulfillment: true }),

    addItem: (item, restaurantId, locationId, selectedAddOns = []) => {
        const currentItems = get().items;

        // If adding from a different restaurant OR different branch, clear cart first
        if (currentItems.length > 0 && (currentItems[0].restaurant_id !== restaurantId || currentItems[0].location_id !== locationId)) {
            const compositeId = `${item.id}-${JSON.stringify(selectedAddOns)}`;
            const newItem = { 
                ...item, 
                id: compositeId, 
                menu_item_id: item.id,
                qty: 1, 
                restaurant_id: restaurantId,
                location_id: locationId,
                selected_add_ons: selectedAddOns
            };
            const itemPrice = item.price + selectedAddOns.reduce((s, a) => s + a.price, 0);
            set({ items: [newItem], total: itemPrice });
            return;
        }

        const compositeId = `${item.id}-${JSON.stringify(selectedAddOns)}`;
        const existing = currentItems.find(i => i.id === compositeId);
        
        let newItems;
        if (existing) {
            newItems = currentItems.map(i => i.id === compositeId ? { ...i, qty: i.qty + 1 } : i);
        } else {
            newItems = [...currentItems, { 
                ...item, 
                id: compositeId, 
                menu_item_id: item.id,
                qty: 1, 
                restaurant_id: restaurantId,
                location_id: locationId,
                selected_add_ons: selectedAddOns
            }];
        }

        const calculateTotal = (items: CartItem[]) => 
            items.reduce((sum, i) => {
                const itemBasePrice = i.price;
                const extrasPrice = i.selected_add_ons.reduce((s, a) => s + a.price, 0);
                return sum + ((itemBasePrice + extrasPrice) * i.qty);
            }, 0);

        set({ items: newItems, total: calculateTotal(newItems) });
    },

    removeItem: (id) => {
        const newItems = get().items.filter(i => i.id !== id);
        const calculateTotal = (items: CartItem[]) => 
            items.reduce((sum, i) => {
                const itemBasePrice = i.price;
                const extrasPrice = i.selected_add_ons.reduce((s, a) => s + a.price, 0);
                return sum + ((itemBasePrice + extrasPrice) * i.qty);
            }, 0);
        set({ items: newItems, total: calculateTotal(newItems) });
    },

    updateQty: (id, delta) => {
        const newItems = get().items.map(i => {
            if (i.id === id) {
                const newQty = Math.max(0, i.qty + delta);
                return { ...i, qty: newQty };
            }
            return i;
        }).filter(i => i.qty > 0);
        const calculateTotal = (items: CartItem[]) => 
            items.reduce((sum, i) => {
                const itemBasePrice = i.price;
                const extrasPrice = i.selected_add_ons.reduce((s, a) => s + a.price, 0);
                return sum + ((itemBasePrice + extrasPrice) * i.qty);
            }, 0);
        set({ items: newItems, total: calculateTotal(newItems) });
    },

    clearCart: () => set({ items: [], total: 0, fulfillmentType: null, hasChosenFulfillment: false }),
}));
