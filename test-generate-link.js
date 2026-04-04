const fetch = require('node-fetch');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ydcbycanrbdcyyabnfxn.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY; // Removed hardcoded secret
const testEmail = 'malmanyeza@gmail.com'; 

async function generateResetLink() {
    console.log('--- SUPABASE SERVICE ROLE LINK DIAGNOSTIC ---');
    console.log(`Targeting: ${SUPABASE_URL}`);
    
    try {
        // Attempt to generate a recovery link using the admin API
        const response = await fetch(`${SUPABASE_URL}/auth/v1/admin/generate_link`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${SERVICE_KEY}`,
                'apikey': SERVICE_KEY,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                type: 'recovery',
                email: testEmail,
                options: {
                    redirectTo: 'appetite://reset-password'
                }
            }),
        });

        const status = response.status;
        const data = await response.json();

        console.log(`HTTP Status: ${status}`);
        
        if (status === 200) {
            console.log('SUCCESS: Supabase successfully generated a link.');
            console.log('User Details:', JSON.stringify(data.user, null, 2));
            console.log('\n--- VERIFICATION CHECK ---');
            console.log('Email confirmed at:', data.user.email_confirmed_at);
            
            if (!data.user.email_confirmed_at) {
                console.warn('CRITICAL: This user IS NOT VERIFIED. Reset emails are disabled for unverified accounts.');
            } else {
                console.log('User is verified. If the email still doesn\'t arrive, check the "Sender Email" on the Template Tab specifically.');
            }
        } else {
            console.error('FAILED: Supabase Admin API returned an error.');
            console.log('Error Details:', JSON.stringify(data, null, 2));
        }
    } catch (error) {
        console.error('CRITICAL ERROR: Connection failed.');
        console.error(error.message);
    }
}

generateResetLink();
