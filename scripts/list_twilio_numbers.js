const twilio = require('twilio');
require('dotenv').config();

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;

if (!accountSid || !authToken) {
    console.error('Missing Twilio Credentials');
    process.exit(1);
}

const client = twilio(accountSid, authToken);

(async () => {
    try {
        console.log('--- Fetching Incoming Phone Numbers ---');
        const numbers = await client.incomingPhoneNumbers.list({ limit: 5 });
        if (numbers.length > 0) {
            numbers.forEach(n => console.log(`Found: ${n.phoneNumber}`));
        } else {
            console.log('No incoming phone numbers found.');
        }

        // Also check Outgoing Caller IDs (Verified numbers)
        console.log('\n--- Fetching Outgoing Caller IDs ---');
        const ids = await client.outgoingCallerIds.list({ limit: 5 });
        if (ids.length > 0) {
            ids.forEach(id => console.log(`Verified ID: ${id.phoneNumber}`));
        } else {
            console.log('No verified caller IDs found.');
        }

    } catch (error) {
        console.error('Error fetching numbers:', error.message);
    }
})();
