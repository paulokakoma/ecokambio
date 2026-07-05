const bcrypt = require('bcryptjs');
const hash = '$2b$12$yiHRJK4glOE15/.Pu7YOx.Snycf/Btw.h6I6CqLhF.Xw4toCzq9IW';
const passwords = ['admin', 'admin123', 'admin@123', 'password', 'ecokambio', 'ecoflix', '123456', '12345678'];
passwords.forEach(p => {
    if (bcrypt.compareSync(p, hash)) {
        console.log('Password is:', p);
    }
});
