const http = require('http');
const jwt = require('jsonwebtoken');

const token = jwt.sign({ id: '6b8b7450-d210-46a9-92a0-d15bca2df079', phone: '+244927862935' }, process.env.JWT_SECRET || 'ecoflix_jwt_super_secret_key_2024_change_in_production_a1b2c3d4e5f6');

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/ecoflix/subscriptions/credentials',
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${token}`
  }
};

const req = http.request(options, res => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log(JSON.stringify(JSON.parse(data), null, 2)));
});

req.on('error', error => console.error(error));
req.end();
