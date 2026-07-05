const fs = require('fs');
const file = '/Users/av/Documents/Projetos/ecokambio-main/ecoflix/backend/controllers/subscription.controller.js';
let content = fs.readFileSync(file, 'utf8');

const newMethod = `

// ============================================================================
// PUBLIC SUPPORT (NO AUTH)
// ============================================================================
const publicReportIssue = async (req, res) => {
    try {
        const { phone, issue_type, description } = req.body;
        
        if (!phone) {
            return res.status(400).json({ success: false, message: 'Telefone obrigatório.' });
        }

        const cleanPhone = phone.replace(/[^0-9]/g, '');
        const finalDesc = \`[Suporte Público | Tel: \${cleanPhone}] \` + (description || '');

        const { data, error } = await supabase
            .from('ecoflix_issues')
            .insert([{
                subscription_id: null,
                issue_type,
                description: finalDesc,
                status: 'OPEN'
            }])
            .select()
            .single();

        if (error) throw error;

        // Broadcast to Admins
        try {
            const websocket = require('../../../src/websocket');
            websocket.broadcastToAdmins({
                type: 'new_issue',
                issue: data
            });
        } catch(e) {
            console.error('Failed to broadcast issue:', e);
        }

        res.json({ success: true, message: 'Pedido de suporte enviado com sucesso.' });

    } catch (error) {
        console.error('Public Report error:', error);
        res.status(500).json({ success: false, message: 'Erro ao enviar pedido.' });
    }
};

`;

content = content.replace('module.exports = {', newMethod + 'module.exports = {\n    publicReportIssue,');
fs.writeFileSync(file, content);
console.log('Controller patched successfully');
