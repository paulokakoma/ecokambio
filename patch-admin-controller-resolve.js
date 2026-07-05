const fs = require('fs');
const file = '/Users/av/Documents/Projetos/ecokambio-main/ecoflix/backend/controllers/admin.controller.js';
let content = fs.readFileSync(file, 'utf8');

const newResolve = `const resolveIssue = async (req, res) => {
    try {
        const { id } = req.params;
        const { message } = req.body;
        
        // 1. Fetch the issue to get user info before resolving
        const { data: issue, error: fetchError } = await supabase
            .from('ecoflix_issues')
            .select(\`
                id,
                description,
                subscription:ecoflix_subscriptions(
                    user:ecoflix_users(phone)
                )
            \`)
            .eq('id', id)
            .single();

        if (fetchError) throw fetchError;

        // 2. Resolve issue in DB
        const { data, error } = await supabase
            .from('ecoflix_issues')
            .update({ status: 'RESOLVED', resolved_at: new Date() })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        // 3. Send SMS if phone is found
        let phoneToSend = null;

        // Check if there's an associated user
        if (issue?.subscription?.user?.phone) {
            phoneToSend = issue.subscription.user.phone;
        } 
        // Fallback: Check if it's a public report (contains phone in description)
        else if (issue?.description && issue.description.includes('[Suporte Público | Tel: ')) {
            const match = issue.description.match(/Tel:\s*([0-9]+)\]/);
            if (match && match[1]) {
                phoneToSend = match[1];
            }
        }

        if (phoneToSend) {
            const smsService = require('../services/sms.service');
            await smsService.sendSupportResolutionSms(phoneToSend, message);
        }

        res.json({ success: true, data });
    } catch (error) {
        console.error('Resolve issue error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};`;

content = content.replace(/const resolveIssue = async \(req, res\) => \{[\s\S]*?res\.status\(500\)\.json\(\{ success: false, message: error\.message \}\);\s*\n\};\s*/, newResolve + '\n\n');

fs.writeFileSync(file, content);
console.log('Controller patched successfully');
