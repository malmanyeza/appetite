const fetch = require('node-fetch');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ydcbycanrbdcyyabnfxn.supabase.co';
const ANON_KEY = process.env.SUPABASE_ANON_KEY; // Removed hardcoded secret
const testEmail = 'malmanyeza@gmail.com'; 

async function testPasswordReset() {
    console.log('--- SUPABASE PASSWORD RESET DIAGNOSTIC ---');
    console.log(`Targeting: ${SUPABASE_URL}`);
    console.log(`Email: ${testEmail}`);

    if (!SUPABASE_URL || !ANON_KEY) {
        console.error('CRITICAL: Missing SUPABASE_URL or SUPABASE_ANON_KEY in .env');
        return;
    }

    try {
        const response = await fetch(`${SUPABASE_URL}/auth/v1/recover`, {
            method: 'POST',
            headers: {
                'apikey': ANON_KEY,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email: testEmail }),
        });

        const status = response.status;
        const data = await response.json();

        console.log(`HTTP Status: ${status}`);
        
        if (status === 200 || status === 204) {
            console.log('SUCCESS (From API perspective): Supabase says it sent the email.');
        } else {
            console.error('FAILED: Supabase returned an error.');
            console.log('Error Details:', JSON.stringify(data, null, 2));
        }
    } catch (error) {
        console.error('CRITICAL ERROR: Connection failed.');
        console.error(error.message);
    }
}

testPasswordReset();
