// const fetch = require('node-fetch'); // Not needed in Node 18+

const resendApiKey = process.env.RESEND_API_KEY; // Removed hardcoded secret
const senderEmail = 'appetite@nexura.co.zw';
const testRecipient = 'malmanyeza@gmail.com'; 

async function sendTestEmail() {
    console.log('--- RESEND DIRECT DIAGNOSTIC ---');
    console.log(`Attempting to send from: ${senderEmail} to ${testRecipient}`);
    
    try {
        const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${resendApiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                from: `Appetite <${senderEmail}>`,
                to: [testRecipient],
                subject: 'Resend Direct Diagnostic Test',
                html: '<strong>Resend API is working!</strong> If you received this, the problem is in your Supabase Auth settings.',
            }),
        });

        const data = await response.json();
        if (response.ok) {
            console.log('SUCCESS: Email sent successfully via Resend API.');
            console.log('Result:', JSON.stringify(data, null, 2));
        } else {
            console.error('FAILED: Resend API returned an error.');
            console.log('Error Data:', JSON.stringify(data, null, 2));
        }
    } catch (error) {
        console.error('CRITICAL ERROR: Could not connect to Resend API.');
        console.error(error.message);
    }
}

sendTestEmail();
