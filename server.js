const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const { Pool } = require('pg');

const app = express();

const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

/*
========================================
KONEKSI POSTGRESQL
========================================
*/
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

/*
========================================
CEK KONEKSI DATABASE
========================================
*/
async function initDatabase() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY,
        username VARCHAR(100) NOT NULL UNIQUE,
        password TEXT NOT NULL
      );
    `);

    console.log('PostgreSQL berhasil terhubung.');
    console.log('Tabel users siap digunakan.');
  } catch (error) {
    console.error(
      'GAGAL TERHUBUNG KE POSTGRESQL:',
      error.message
    );
  }
}

/*
========================================
DATA SMART BIN
========================================
*/
let smartBinData = {
  id: 'SB-001',
  fullness: 50,
  weight: 2.5,
  status: 'NORMAL',
};

/*
========================================
FUNCTION HASH PASSWORD
========================================
*/
function hashPassword(password) {
  return crypto
    .createHash('sha256')
    .update(password)
    .digest('hex');
}

/*
========================================
REGISTER
========================================
POST /api/auth/register
========================================
*/
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username dan password harus diisi.',
      });
    }

    const cleanUsername = username.trim();

    if (cleanUsername.length < 3) {
      return res.status(400).json({
        success: false,
        message: 'Username minimal 3 karakter.',
      });
    }

    if (password.length < 5) {
      return res.status(400).json({
        success: false,
        message: 'Password minimal 5 karakter.',
      });
    }

    /*
    Cek username yang sama
    */
    const existingUser = await pool.query(
      `
      SELECT id
      FROM users
      WHERE LOWER(username) = LOWER($1)
      `,
      [cleanUsername]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Username sudah digunakan.',
      });
    }

    /*
    Buat akun baru
    */
    const userId = crypto.randomUUID();
    const passwordHash = hashPassword(password);

    await pool.query(
      `
      INSERT INTO users (
        id,
        username,
        password
      )
      VALUES ($1, $2, $3)
      `,
      [
        userId,
        cleanUsername,
        passwordHash,
      ]
    );

    console.log('USER BARU:', {
      id: userId,
      username: cleanUsername,
    });

    return res.status(201).json({
      success: true,
      message: 'Akun berhasil dibuat.',
      user: {
        id: userId,
        username: cleanUsername,
      },
    });

  } catch (error) {
    console.error(
      'REGISTER ERROR:',
      error.message
    );

    return res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan pada server.',
    });
  }
});

/*
========================================
LOGIN
========================================
POST /api/auth/login
========================================
*/
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username dan password harus diisi.',
      });
    }

    const cleanUsername = username.trim();

    /*
    Cari akun berdasarkan username
    */
    const result = await pool.query(
      `
      SELECT id, username, password
      FROM users
      WHERE LOWER(username) = LOWER($1)
      `,
      [cleanUsername]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Username atau password salah.',
      });
    }

    const user = result.rows[0];

    /*
    Cek password
    */
    const passwordHash = hashPassword(password);

    if (passwordHash !== user.password) {
      return res.status(401).json({
        success: false,
        message: 'Username atau password salah.',
      });
    }

    console.log(
      'LOGIN BERHASIL:',
      user.username
    );

    return res.json({
      success: true,
      message: 'Login berhasil.',
      user: {
        id: user.id,
        username: user.username,
      },
    });

  } catch (error) {
    console.error(
      'LOGIN ERROR:',
      error.message
    );

    return res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan pada server.',
    });
  }
});

/*
========================================
GET SMART BIN DATA
========================================
*/
app.get('/api/smart-bin', (req, res) => {
  res.json(smartBinData);
});

/*
========================================
UPDATE SMART BIN DATA
========================================
*/
app.post('/api/smart-bin', (req, res) => {
  const {
    id,
    fullness,
    weight,
    status,
  } = req.body;

  if (
    id === undefined ||
    fullness === undefined ||
    weight === undefined ||
    status === undefined
  ) {
    return res.status(400).json({
      message: 'Data Smart Bin tidak lengkap.',
    });
  }

  smartBinData = {
    id,
    fullness: Number(fullness),
    weight: Number(weight),
    status,
  };

  console.log(
    'Data Smart Bin diperbarui:',
    smartBinData
  );

  return res.json({
    message: 'Data Smart Bin berhasil diperbarui.',
    data: smartBinData,
  });
});

/*
========================================
SIMULATOR SMART BIN
========================================
*/
setInterval(() => {
  smartBinData.fullness += 5;
  smartBinData.weight += 0.5;

  if (smartBinData.fullness > 100) {
    smartBinData.fullness = 100;
  }

  if (smartBinData.weight > 10) {
    smartBinData.weight = 10;
  }

  if (smartBinData.fullness >= 90) {
    smartBinData.status =
      'HAMPIR PENUH - SEGERA DIANGKUT';
  } else if (smartBinData.fullness >= 75) {
    smartBinData.status =
      'DAPAT DIANGKUT';
  } else {
    smartBinData.status = 'NORMAL';
  }

  console.log(
    'Simulator:',
    smartBinData
  );
}, 5000);

/*
========================================
START SERVER
========================================
*/
app.listen(PORT, '0.0.0.0', async () => {
  console.log(
    `Smart Bin API berjalan di port ${PORT}`
  );

  await initDatabase();
});