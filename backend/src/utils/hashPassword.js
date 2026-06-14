// Usage: node src/utils/hashPassword.js <plaintext-password>
const bcrypt = require('bcrypt');
const pwd = process.argv[2] || 'password123';
bcrypt.hash(pwd, 10).then((hash) => console.log(hash));
