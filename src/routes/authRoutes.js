const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const isAdmin = require('../middleware/auth');
const { loginValidationRules } = require('../middleware/authValidation');
const { handleValidationErrors } = require('../middleware/validator');
const catchAsync = require('../utils/catchAsync');

router.post('/login', authController.login);
router.post(
    '/login',
    loginValidationRules(),
    handleValidationErrors,
    catchAsync(authController.login)
);
router.post('/logout', authController.logout);
router.get('/me', isAdmin, authController.me);

module.exports = router;
