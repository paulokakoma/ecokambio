const { body } = require('express-validator');

const loginValidationRules = () => {
    return [
        // O email não pode estar vazio e deve ser um email válido.
        body('email').notEmpty().withMessage('O email é obrigatório.').isEmail().withMessage('Por favor, insira um email válido.'),

        // A password deve ter pelo menos 6 caracteres.
        body('password').isLength({ min: 6 }).withMessage('A password deve ter no mínimo 6 caracteres.'),
    ];
};

module.exports = { loginValidationRules };