const fetch = require('node-fetch');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ydcbycanrbdcyyabnfxn.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY; // Removed hardcoded secret
const testEmail = 'malmanyeza@gmail.com'; 

async function checkUserStatus() {
    console.log('--- SUPABASE USER VERIFICATION DIAGNOSTIC ---');
    
    try {
        // Use the Admin API to get user details by email
        // We need to list users and find our guy because there's no direct "getUserByEmail" in the REST API easily
        const response = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${SERVICE_KEY}`,
                'apikey': SERVICE_KEY,
            },
        });

        const data = await response.json();
        const users = data.users || [];
        const user = users.find(u => u.email === testEmail);

        if (!user) {
            console.error(`FAILED: No user found with email: ${testEmail}`);
            console.log('Registered Users:', users.map(u => u.email).join(', '));
            return;
        }

        console.log('SUCCESS: User found.');
        console.log(`Email: ${user.email}`);
        console.log(`Confirmed At: ${user.email_confirmed_at || 'NOT CONFIRMED'}`);
        console.log(`Last Sign In: ${user.last_sign_in_at || 'NEVER'}`);

        if (!user.email_confirmed_at) {
            console.warn('\n--- THE PROBLEM ---');
            console.warn('Your account IS NOT CONFIRMED. Supabase will block all password reset emails for this account.');
            console.warn('To fix this, go to Authentication -> Users and manually click "Confirm User" (or click the link in your sign-up email).');
        } else {
            console.log('\n--- ACCOUNT IS VERIFIED ---');
            console.log('If the email still isn\'t coming, the issue is 100% the "Sender Email" setting on the "Templates" tab.');
        }

    } catch (error) {
        console.error('CRITICAL ERROR: Connection failed.');
        console.error(error.message);
    }
}

checkUserStatus();
