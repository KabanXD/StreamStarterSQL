-- schema.sql для Supabase (PostgreSQL)
-- Вставьте в Supabase → SQL Editor → New query → Run

-- Таблица товаров
CREATE TABLE IF NOT EXISTS products (
  id               SERIAL PRIMARY KEY,
  name             VARCHAR(200)     NOT NULL,
  price            NUMERIC(10,2)    NOT NULL DEFAULT 0,
  category         VARCHAR(100),
  brand            VARCHAR(100),
  tag              VARCHAR(100),
  popularity       INTEGER          NOT NULL DEFAULT 50,
  available        BOOLEAN          NOT NULL DEFAULT true,
  description      TEXT,
  long_description TEXT,
  specs            TEXT,
  thumb            TEXT,
  created_at       TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ      NOT NULL DEFAULT NOW()
);

-- Таблица изображений
CREATE TABLE IF NOT EXISTS product_images (
  id          SERIAL PRIMARY KEY,
  product_id  INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  filename    TEXT    NOT NULL,
  position    INTEGER NOT NULL DEFAULT 0
);

-- Таблица администраторов
CREATE TABLE IF NOT EXISTS admins (
  id            SERIAL PRIMARY KEY,
  username      VARCHAR(100) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Индексы
CREATE INDEX IF NOT EXISTS idx_products_category   ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_brand      ON products(brand);
CREATE INDEX IF NOT EXISTS idx_products_popularity ON products(popularity);
CREATE INDEX IF NOT EXISTS idx_images_product      ON product_images(product_id);
