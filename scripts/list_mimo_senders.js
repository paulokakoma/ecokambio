
const axios = require('axios');
const dotenv = require('dotenv');
dotenv.config();

const listSenders = async () => {
    console.log('Listing Mimo Sender IDs...');

    if (!process.env.MIMO_API_TOKEN) {
        console.error('ERROR: MIMO_API_TOKEN not found in .env');
        return;
    }

    const token = process.env.MIMO_API_TOKEN;
    const url = `http://52.30.114.86:8080/mimosms/v1/sender-id/list-all/requested?token=${token}`;

    // Common patterns for Mimo might be /sender/all or just /sender
    // Let's try a few if the first fails, but strictly one request first.
    // Based on search "Sender ID management (requesting, excluding, listing...)"

    try {
        console.log(`GET ${url}`);
        const response = await axios.get(url);

        console.log('Response Status:', response.status);
        console.log('Response Data:', response.data);
    } catch (error) {
        console.error('Request Failed:', error.message);
        if (error.response) {
            console.error('API Response:', error.response.data);

            // Try another common endpoint if 404
            if (error.response.status === 404) {
                console.log('Trying /mimosms/v1/sender ...');
                try {
                    const url2 = `http://52.30.114.86:8080/mimosms/v1/sender?token=${token}`;
                    const res2 = await axios.get(url2);
                    console.log('Response 2:', res2.data);
                } catch (e2) {
                    console.error('Retry Failed:', e2.message);
                }
            }
        }
    }
};

listSenders();
