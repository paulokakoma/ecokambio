const bcrypt = require("bcrypt");
const config = require("../config/env");

const login = async (req, res) => {
    const { username, password } = req.body;

    if (!password || !config.admin.passwordHash) {
        return res.status(400).json({ success: false, message: 'Pedido inválido.' });
    }

    console.log('Login attempt:', { username, passwordProvided: !!password, hashConfigured: !!config.admin.passwordHash });
    console.log('Hash from config:', config.admin.passwordHash);

    const match = await bcrypt.compare(password, config.admin.passwordHash);
    console.log('Password match result:', match);

    if (match) {
        // Determine user type and set redirect path
        const usernameLower = (username || '').toLowerCase();
        let redirectPath = '/admin'; // Default
        let userType = 'admin'; // Default

        // Check if user is adminflix
        if (usernameLower === 'adminflix') {
            redirectPath = '/netflix/adminflix.html';
            userType = 'adminflix';
        } else if (usernameLower === 'admin' || usernameLower === 'lando pedro') {
            redirectPath = '/private/admin.html';
            userType = 'admin';
        }

        // Use Redis-backed session
        req.session.admin = true;
        req.session.user = { role: 'admin', username: usernameLower, type: userType };

        // Set signed cookie for page access verification
        res.cookie('admin_auth', 'true', {
            signed: true,
            httpOnly: true,
            maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
            sameSite: 'lax',
            secure: !config.isDevelopment
        });

        req.session.save((err) => {
            if (err) {
                console.error('Session save error:', err);
                return res.status(500).json({ success: false, message: 'Erro ao salvar sessão.' });
            }

            if (config.isDevelopment) {
                console.log(`Login bem-sucedido para ${username}. Redirecionando para: ${redirectPath}`);
            }

            return res.status(200).json({
                success: true,
                message: 'Login bem-sucedido.',
                redirect: redirectPath
            });
        });
    } else {
        res.status(401).json({ success: false, message: 'Senha incorreta.' });
    }
};

const logout = (req, res) => {
    req.session.destroy();
    res.clearCookie('connect.sid'); // Default session cookie name
    res.status(200).json({ success: true, message: 'Logout bem-sucedido.' });
};

const me = (req, res) => {
    res.status(200).json({
        email: 'admin@ecokambio.com',
        user_metadata: { full_name: 'Admin' }
    });
};

module.exports = { login, logout, me };
