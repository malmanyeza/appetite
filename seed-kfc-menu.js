require('dotenv').config();
const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const KFC_ID = "8852ff4b-7f57-48b6-bd4d-5b4b81c410b9";

const headers = {
    'apikey': SERVICE_ROLE_KEY,
    'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
};

const menuItems = [
    {
        name: "12 Piece Value Bucket",
        description: "12 pieces of our legendary Original Recipe chicken. Perfect for sharing.",
        price: 19.00,
        category: "Buckets",
        image_url: "https://images.unsplash.com/photo-1513639776629-7b61b0ac49cb?auto=format&fit=crop&w=800&q=80",
        add_ons: [
            { name: "Add Large Chips", price: 3.00 },
            { name: "Add 2L Soft Drink", price: 2.50 },
            { name: "Extra Gravy", price: 1.00 }
        ]
    },
    {
        name: "Colonel Burger Meal",
        description: "Original Recipe Colonel Burger, regular chips, and a 330ml drink.",
        price: 8.50,
        category: "Burgers",
        image_url: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=800&q=80",
        add_ons: [
            { name: "Add Cheese", price: 0.50 },
            { name: "Add Jalapenos", price: 0.50 },
            { name: "Upsize to Large Chips", price: 1.50 }
        ]
    },
    {
        name: "Streetwise 2",
        description: "2 pieces of Original Recipe chicken and a small portion of chips.",
        price: 6.00,
        category: "Streetwise",
        image_url: "https://images.unsplash.com/photo-1562967914-608f82629710?auto=format&fit=crop&w=800&q=80",
        add_ons: [
            { name: "Add 330ml Soft Drink", price: 1.00 },
            { name: "Extra Piece of Chicken", price: 2.00 }
        ]
    },
    {
        name: "Loaded Fries",
        description: "Golden chips topped with melted cheese, spicy sauce, and crispy chicken bits.",
        price: 3.50,
        category: "Sides",
        image_url: "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=800&q=80",
        add_ons: [
            { name: "Extra Cheese", price: 0.75 },
            { name: "Add Bacon Bits", price: 1.00 }
        ]
    },
    {
        name: "Wicked Zinger Box Meal",
        description: "Zinger Burger, 1 piece of chicken, 2 zinger wings, chips, and a drink.",
        price: 13.50,
        category: "Box Meals",
        image_url: "https://images.unsplash.com/photo-1594212699903-ec8a3ecc50f1?auto=format&fit=crop&w=800&q=80",
        add_ons: [
            { name: "Dunked Wings Upgrade", price: 1.00 },
            { name: "Add Coleslaw", price: 1.00 }
        ]
    }
];

(async () => {
    try {
        console.log(`Clearing existing menu for KFC (${KFC_ID})...`);
        const delRes = await fetch(`${SUPABASE_URL}/rest/v1/menu_items?restaurant_id=eq.${KFC_ID}`, {
            method: 'DELETE',
            headers
        });
        if (delRes.ok) console.log('✅ Menu cleared.');

        console.log('Seeding new KFC menu...');
        for (const item of menuItems) {
            const res = await fetch(`${SUPABASE_URL}/rest/v1/menu_items`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    ...item,
                    restaurant_id: KFC_ID,
                    is_available: true
                })
            });
            if (res.ok) {
                console.log(`   ✅ Added ${item.name}`);
            } else {
                console.error(`   ❌ Failed ${item.name}:`, await res.text());
            }
        }
        console.log('\nDONE! KFC menu updated with 5 premium items.');
    } catch (e) {
        console.error('Fatal:', e);
    }
})();
