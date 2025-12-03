const bcrypt = require("bcrypt");
const config = require("../config/env");

const login = async (req, res) => {
    const { password } = req.body;
    if (!password || !config.admin.passwordHash) {
        return res.status(400).json({ success: false, message: 'Pedido inválido.' });
    }

    console.log('Login attempt:', { passwordProvided: !!password, hashConfigured: !!config.admin.passwordHash });
    console.log('Hash from config:', config.admin.passwordHash);
    const match = await bcrypt.compare(password, config.admin.passwordHash);
    console.log('Password match result:', match);

    if (match) {
        // Use signed cookie instead of session for serverless compatibility
        res.cookie('admin_auth', 'true', {
            httpOnly: true,
            secure: !config.isDevelopment,
            signed: true,
            maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
            sameSite: 'lax'
            // Don't set domain - let it default to current hostname
        });

        if (config.isDevelopment) {
            console.log('Login bem-sucedido. Cookie criado.');
        }
        return res.status(200).json({ success: true, message: 'Login bem-sucedido.' });
    } else {
        res.status(401).json({ success: false, message: 'Senha incorreta.' });
    }
};

const logout = (req, res) => {
    res.clearCookie('admin_auth');
    res.status(200).json({ success: true, message: 'Logout bem-sucedido.' });
};

const me = (req, res) => {
    res.status(200).json({
        email: 'admin@ecokambio.com',
        user_metadata: { full_name: 'Admin' }
    });
};

module.exports = { login, logout, me };
