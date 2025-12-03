const bcrypt = require('bcrypt');

// Pega a senha a partir do argumento da linha de comando
const password = process.argv[2];

if (!password) {
  console.error('Erro: Forneça a senha como um argumento.');
  console.log('Uso: node generate-hash.js "sua-senha-aqui"');
  process.exit(1);
}

// O "salt rounds" define o quão custoso será o cálculo do hash. 12 é um bom valor.
const saltRounds = 12;

bcrypt.hash(password, saltRounds)
  .then(hash => {
    console.log('Senha com Hash:');
    console.log(hash);
  })
  .catch(err => {
    console.error('Erro ao gerar o hash:', err);
  });