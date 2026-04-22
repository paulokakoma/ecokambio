const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Basic Health Check
app.get('/', (req, res) => {
  res.json({ message: 'EcoPay Backend is running', timestamp: new Date() });
});

// Routes
const userRoutes = require('./routes/user');
const paymentRoutes = require('./routes/payment');
app.use('/api/users', userRoutes);
app.use('/api/payments', paymentRoutes);

app.listen(PORT, () => {
  console.log(`EcoPay Server started on port ${PORT}`);
});
