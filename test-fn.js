require('dotenv').config();
const url = `${process.env.SUPABASE_URL}/functions/v1/scan-menu-ai`;

fetch(url, {
    method: 'OPTIONS'
}).then(res => console.log('OPTIONS status:', res.status));

fetch(url, {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json'
    },
    body: JSON.stringify({ url: "https://example.com" })
}).then(async res => {
    console.log('POST status:', res.status);
    console.log('POST body:', await res.text());
}).catch(console.error);
