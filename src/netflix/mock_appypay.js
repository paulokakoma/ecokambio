/**
 * Local AppyPay Mock Controller
 * Simulates the external AppyPay API for development/testing
 */

const express = require('express');
const router = express.Router();

// Mock Payment Endpoint
// POST /payment
router.post('/payment', (req, res) => {
    try {
        const { amount, phone, description, method } = req.body;

        console.log('[Mock AppyPay] Received Payment Request:', { amount, phone, method });

        if (!amount || !phone) {
            return res.status(400).json({
                success: false,
                message: 'Invalid request: amount and phone are required'
            });
        }

        // Generate Mock Data
        const reference = Math.floor(100000000 + Math.random() * 900000000).toString(); // 9 digits
        const transaction_id = `mock_${Date.now()}`;
        const entity = '90000'; // Standard mock entity

        // Simulate Success Response
        const responseData = {
            success: true,
            message: 'Payment reference created successfully',
            reference: reference, // Raw reference (no spaces usually in API, but we clean it anyway)
            entity: entity,
            amount: amount,
            transaction_id: transaction_id,
            status: 'pending' // Initial status is pending
        };

        console.log('[Mock AppyPay] Responding with:', responseData);

        // Return 200 OK
        res.status(200).json(responseData);

    } catch (error) {
        console.error('[Mock AppyPay] Error:', error);
        res.status(500).json({ success: false, message: 'Internal Mock Error' });
    }
});

module.exports = router;
