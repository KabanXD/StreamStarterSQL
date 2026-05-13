// api/index.js  — запускается Vercel как serverless function
const express = require('express');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

const app = express();
app.use(express.json({ limit: '20mb' }));

// CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// Подключение к Supabase (PostgreSQL)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || process.env.database_url,
  ssl: { rejectUnauthorized: false }
});

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret';

// ─── Auth middleware ───────────────────────────────────────
function auth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer '))
    return res.status(401).json({ error: 'Unauthorized' });
  try {
    req.user = jwt.verify(header.split(' ')[1], JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

function parseJson(val) {
  if (!val) return [];
  try { return typeof val === 'string' ? JSON.parse(val) : val; } catch { return []; }
}

// ─── Health ───────────────────────────────────────────────
app.get('/api/health', (req, res) => res.json({ ok: true }));

// ─── Login ────────────────────────────────────────────────
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password)
      return res.status(400).json({ error: 'Введите логин и пароль' });

    const { rows } = await pool.query(
      'SELECT * FROM admins WHERE username = $1', [username]
    );
    const admin = rows[0];
    if (!admin || !(await bcrypt.compare(password, admin.password_hash)))
      return res.status(401).json({ error: 'Неверный логин или пароль' });

    const token = jwt.sign(
      { id: admin.id, username: admin.username },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
    res.json({ token, username: admin.username });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// ─── Создание первого админа ──────────────────────────────
app.post('/api/auth/create-admin', async (req, res) => {
  try {
    const { username, password, secret } = req.body || {};
    if (secret !== process.env.CREATE_ADMIN_SECRET)
      return res.status(403).json({ error: 'Forbidden' });
    const hash = await bcrypt.hash(password, 10);
    await pool.query(
      'INSERT INTO admins (username, password_hash) VALUES ($1, $2)', [username, hash]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка: ' + err.message });
  }
});

// ─── GET все товары ───────────────────────────────────────
app.get('/api/products', async (req, res) => {
  try {
    const { cat, brand, search, sort, limit = 200 } = req.query;
    const params = [];
    let sql = 'SELECT * FROM products WHERE 1=1';

    if (cat)    { params.push(cat);    sql += ` AND category = $${params.length}`; }
    if (brand)  { params.push(brand);  sql += ` AND brand = $${params.length}`; }
    if (search) {
      params.push(`%${search}%`);
      sql += ` AND (name ILIKE $${params.length} OR description ILIKE $${params.length} OR brand ILIKE $${params.length})`;
    }

    sql += sort === 'price-asc'  ? ' ORDER BY price ASC'
         : sort === 'price-desc' ? ' ORDER BY price DESC'
         : ' ORDER BY popularity DESC';

    params.push(Number(limit));
    sql += ` LIMIT $${params.length}`;

    const { rows: products } = await pool.query(sql, params);

    // Изображения
    let imgMap = {};
    if (products.length) {
      const ids = products.map(p => p.id);
      const { rows: imgs } = await pool.query(
        'SELECT * FROM product_images WHERE product_id = ANY($1) ORDER BY position ASC',
        [ids]
      );
      imgs.forEach(img => {
        imgMap[img.product_id] = imgMap[img.product_id] || [];
        imgMap[img.product_id].push(img.filename);
      });
    }

    res.json(products.map(p => ({
      id: p.id, name: p.name, price: Number(p.price), category: p.category,
      brand: p.brand, tag: p.tag, popularity: p.popularity, available: !!p.available,
      description: p.description, long_description: p.long_description || '',
      specs: parseJson(p.specs),
      images: imgMap[p.id] || [],
      thumb: (imgMap[p.id] && imgMap[p.id][0]) || p.thumb || null
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// ─── GET один товар ───────────────────────────────────────
app.get('/api/products/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM products WHERE id = $1', [req.params.id]);
    const p = rows[0];
    if (!p) return res.status(404).json({ error: 'Не найден' });

    const { rows: imgs } = await pool.query(
      'SELECT filename FROM product_images WHERE product_id = $1 ORDER BY position ASC',
      [p.id]
    );
    const images = imgs.map(r => r.filename);
    res.json({
      id: p.id, name: p.name, price: Number(p.price), category: p.category,
      brand: p.brand, tag: p.tag, popularity: p.popularity, available: !!p.available,
      description: p.description, long_description: p.long_description || '',
      specs: parseJson(p.specs),
      images, thumb: images[0] || p.thumb || null
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// ─── POST создать товар ───────────────────────────────────
app.post('/api/products', auth, async (req, res) => {
  try {
    const {
      name, price = 0, category, brand, tag, popularity = 50,
      available = true, description, long_description = '',
      specs, images = [], thumb = ''
    } = req.body;

    const { rows } = await pool.query(
      `INSERT INTO products
         (name, price, category, brand, tag, popularity, available,
          description, long_description, specs, thumb)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING *`,
      [name, price, category, brand, tag, popularity, available,
       description, long_description,
       specs ? JSON.stringify(specs) : null,
       images[0] || thumb || '']
    );
    const product = rows[0];

    if (images.length) {
      for (let i = 0; i < images.length; i++) {
        await pool.query(
          'INSERT INTO product_images (product_id, filename, position) VALUES ($1,$2,$3)',
          [product.id, images[i], i]
        );
      }
    }
    res.status(201).json({ ...product, id: product.id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка сохранения: ' + err.message });
  }
});

// ─── PUT обновить товар ───────────────────────────────────
app.put('/api/products/:id', auth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const {
      name, price = 0, category, brand, tag, popularity = 50,
      available = true, description, long_description = '',
      specs, images, thumb = ''
    } = req.body;

    const { rows } = await pool.query(
      `UPDATE products SET
         name=$1, price=$2, category=$3, brand=$4, tag=$5, popularity=$6,
         available=$7, description=$8, long_description=$9, specs=$10, thumb=$11,
         updated_at=NOW()
       WHERE id=$12
       RETURNING *`,
      [name, price, category, brand, tag, popularity, available,
       description, long_description,
       specs ? JSON.stringify(specs) : null,
       (images && images[0]) || thumb || '',
       id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Не найден' });

    if (Array.isArray(images)) {
      await pool.query('DELETE FROM product_images WHERE product_id = $1', [id]);
      for (let i = 0; i < images.length; i++) {
        await pool.query(
          'INSERT INTO product_images (product_id, filename, position) VALUES ($1,$2,$3)',
          [id, images[i], i]
        );
      }
    }
    res.json({ ...rows[0], id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка обновления: ' + err.message });
  }
});

// ─── DELETE удалить товар ─────────────────────────────────
app.delete('/api/products/:id', auth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    await pool.query('DELETE FROM product_images WHERE product_id = $1', [id]);
    await pool.query('DELETE FROM products WHERE id = $1', [id]);
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка удаления' });
  }
});

module.exports = app;
