import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/** Strip script, style, and other noise tags from raw HTML so the AI sees clean content */
function cleanHtml(html: string): string {
    return html
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<svg[\s\S]*?<\/svg>/gi, '')
        .replace(/<noscript[\s\S]*?<\/noscript>/gi, '')
        .replace(/<!--[\s\S]*?-->/g, '')    // strip HTML comments
        .replace(/<[^>]+>/g, ' ')            // strip remaining HTML tags  
        .replace(/\s{2,}/g, ' ')             // collapse whitespace
        .trim();
}

/** Normalize lazy-loaded image attributes so AI can find them in raw HTML */
function normalizeLazyImages(html: string): string {
    return html
        .replace(/data-src="/gi, 'src="')
        .replace(/data-lazy-src="/gi, 'src="')
        .replace(/data-original="/gi, 'src="')
        .replace(/data-srcset="/gi, 'srcset="');
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const { imageBase64, mimeType, url } = await req.json();

        if (!imageBase64 && !url) {
            return new Response(JSON.stringify({ error: 'Missing either image Base64 data or a website URL' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        const apiKey = Deno.env.get('OPENAI_API_KEY')?.trim();
        if (!apiKey) {
            return new Response(JSON.stringify({ error: 'Missing OPENAI_API_KEY in Edge Function secrets.' }), {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        const systemPrompt = `You are an expert AI data parser for a food delivery platform. Your job is to extract EVERY single food or drink item from the provided menu data. Be exhaustive — do not miss items.

Return your response EXCLUSIVELY as a raw, valid JSON array of objects. No markdown, no explanation, just the raw array.

Each object MUST have this exact structure:
{
    "name": "String - the food item name",
    "description": "String - ingredients or details (empty string if none)",
    "price": Number - the price as a float (e.g. 12.99). Use 0 if price is not listed,
    "category": "String - the section header this item falls under (e.g. Burgers, Drinks, Sides)",
    "image_url": "String - the full absolute URL of the item's image if found in the content, otherwise empty string",
    "add_ons": [
        { "name": "String", "price": Number }
    ]
}

Rules:
- Extract EVERY menu item you can find. Be thorough and systematic.
- Convert all prices to numeric floats, strip currency symbols.
- For image_url: look for <img> src attributes, og:image, or any thumbnail URL clearly associated with that specific menu item. Use the full absolute URL. If none found specifically for that item, use empty string "".
- For add_ons: capture toppings, extras, size options. If item has sizes (Small/Large), list them as add_ons.
- Do NOT include non-food items like gift cards, merchandise, etc.`;

        let messages: any[];

        if (url) {
            let finalUrl = url.trim();
            if (!finalUrl.startsWith('http')) finalUrl = 'https://' + finalUrl;

            console.log(`Fetching HTML from: ${finalUrl}`);
            try {
                const websiteRes = await fetch(finalUrl, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                        'Accept-Language': 'en-US,en;q=0.5',
                    }
                });
                const rawHtml = await websiteRes.text();
                // Normalize lazy-loaded images so AI can find their URLs
                const normalizedHtml = normalizeLazyImages(rawHtml);
                const rawSnippet = normalizedHtml.substring(0, 300000);
                const cleanedText = cleanHtml(normalizedHtml).substring(0, 150000);

                messages = [
                    { role: 'system', content: systemPrompt },
                    {
                        role: 'user',
                        content: `Please extract ALL menu items from this restaurant website.\n\n--- RAW HTML (for finding image URLs) ---\n${rawSnippet}\n\n--- CLEANED TEXT (for reading menu items) ---\n${cleanedText}`
                    }
                ];
            } catch (err: any) {
                return new Response(JSON.stringify({ error: 'Failed to access the website: ' + err.message }), {
                    status: 200,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                });
            }
        } else {
            const base64Data = imageBase64.replace(/^data:image\/[a-z]+;base64,/, '');
            const imageMediaType = mimeType || 'image/jpeg';

            messages = [
                { role: 'system', content: systemPrompt },
                {
                    role: 'user',
                    content: [
                        { type: 'text', text: 'Please extract ALL menu items from this menu image. For image_url, use empty string since this is an uploaded photo.' },
                        {
                            type: 'image_url',
                            image_url: {
                                url: `data:${imageMediaType};base64,${base64Data}`,
                                detail: 'high'
                            }
                        }
                    ]
                }
            ];
        }

        const requestBody = {
            model: 'gpt-4o-mini',
            messages,
            temperature: 0.1,
            max_tokens: 8192,  // Doubled from 4096 to capture large menus
        };

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify(requestBody)
        });

        const data = await response.json();

        if (data.error) {
            throw new Error(`OpenAI API Error: ${data.error.message}`);
        }

        const rawText = data.choices?.[0]?.message?.content || '[]';
        const cleanedJson = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
        const menuArray = JSON.parse(cleanedJson);

        return new Response(JSON.stringify({ items: menuArray }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

    } catch (error: any) {
        console.error('Error scanning menu:', error);
        return new Response(JSON.stringify({ error: String(error.message || error) }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});
