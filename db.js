const { Pool, types } = require('pg');

types.setTypeParser(1082, val => val);

let dbUrl = (process.env.DATABASE_URL || '').replace(/[?&]sslmode=[^&]*/g, '').replace(/(\?|&)$/, '');

const pool = new Pool({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false }
});

async function query(text, params) {
  return pool.query(text, params);
}

async function initSchema() {
  await query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      name VARCHAR(100) NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS dogs (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name VARCHAR(100) NOT NULL,
      breed VARCHAR(100),
      age INTEGER,
      size VARCHAR(20),
      owner1_name VARCHAR(100),
      owner1_phone VARCHAR(30),
      owner2_name VARCHAR(100),
      owner2_phone VARCHAR(30),
      notes TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS bookings (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      drop_off_time TIME,
      pick_up_time TIME,
      rate INTEGER NOT NULL DEFAULT 0,
      total_cost INTEGER NOT NULL DEFAULT 0,
      status VARCHAR(20) DEFAULT 'confirmed',
      notes TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  const colCheck = await query(`SELECT column_name FROM information_schema.columns WHERE table_name='bookings' AND column_name='dog_id'`);
  if (colCheck.rows.length > 0) {
    await query(`ALTER TABLE bookings DROP COLUMN dog_id CASCADE`);
  }

  await query(`
    CREATE TABLE IF NOT EXISTS booking_dogs (
      booking_id INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
      dog_id INTEGER NOT NULL REFERENCES dogs(id) ON DELETE CASCADE,
      PRIMARY KEY (booking_id, dog_id)
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS dog_images (
      id SERIAL PRIMARY KEY,
      dog_id INTEGER NOT NULL REFERENCES dogs(id) ON DELETE CASCADE,
      image_data TEXT NOT NULL,
      original_name VARCHAR(255),
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
}

module.exports = { query, pool, initSchema };
