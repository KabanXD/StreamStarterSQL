// import_products.js
const fs = require('fs').promises;
const mysql = require('mysql2/promise');
require('dotenv').config();

(async ()=> {
  const DB = {
    host: process.env.DB_HOST||'localhost',
    user: process.env.DB_USER||'root',
    password: process.env.DB_PASS||'',
    database: process.env.DB_NAME||'streamstarter',
    port: process.env.DB_PORT||3306
  };
  const conn = await mysql.createConnection(DB);
  const data = JSON.parse(await fs.readFile('products.json','utf8'));
  for (const p of data) {
    const [r] = await conn.execute(
      'INSERT INTO products (name, price, category, brand, tag, popularity, available, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [p.name, p.price||0, p.category||null, p.brand||null, p.tag||null, p.popularity||50, p.available?1:0, p.desc || p.description || '']
    );
    const pid = r.insertId;
    if (p.images && p.images.length) {
      const rows = p.images.map((fn, idx) => [pid, fn, idx]);
      await conn.query('INSERT INTO product_images (product_id, filename, position) VALUES ?', [rows]);
    } else if (p.thumb) {
      await conn.execute('INSERT INTO product_images (product_id, filename, position) VALUES (?, ?, ?)', [pid, p.thumb, 0]);
    }
    console.log('Inserted', pid, p.name);
  }
  await conn.end();
})();
