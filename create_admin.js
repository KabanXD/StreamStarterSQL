// create_admin.js
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
require('dotenv').config();

(async ()=> {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST||'localhost',
    user: process.env.DB_USER||'root',
    password: process.env.DB_PASS||'',
    database: process.env.DB_NAME||'streamstarter'
  });
  const username = process.argv[2] || 'admin';
  const password = process.argv[3] || 'admin123';
  const hash = await bcrypt.hash(password, 10);
  await conn.execute('INSERT INTO admins (username, password_hash) VALUES (?, ?)', [username, hash]);
  console.log('Created admin', username);
  await conn.end();
})();
