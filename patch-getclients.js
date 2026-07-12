const fs = require('fs');
const file = '/Users/av/Documents/Projetos/ecokambio-main/ecoflix/backend/controllers/admin.controller.js';
let content = fs.readFileSync(file, 'utf8');

const regex = /const getClients = async \(req, res\) => \{[\s\S]*?res\.status\(500\)\.json\(\{ success: false, message: error\.message \}\);\n    \}\n\};/;

const newImplementation = `const getClients = async (req, res) => {
    try {
        const { page = 1, limit = 50 } = req.query;
        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const from = (pageNum - 1) * limitNum;
        const to = from + limitNum - 1;

        const { data, error, count } = await supabase
            .from('ecoflix_subscriptions')
            .select(\`
                *,
                user:ecoflix_users(*),
                profile:ecoflix_profiles(
                    *,
                    master_account:ecoflix_master_accounts(*)
                ),
                account:ecoflix_master_accounts(*)
            \`, { count: 'exact' })
            .order('created_at', { ascending: false })
            .range(from, to);

        if (error) throw error;

        // Map end_date to expires_at so frontend doesn't break
        const mappedData = data.map(sub => ({
            ...sub,
            end_date: sub.expires_at // For renderCustomers compat
        }));

        res.json({ success: true, data: mappedData || [], total: count, page: pageNum, limit: limitNum });
    } catch (error) {
        console.error('Get clients error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};`;

if (regex.test(content)) {
    content = content.replace(regex, newImplementation);
    fs.writeFileSync(file, content);
    console.log('Success');
} else {
    console.log('Regex did not match');
}
