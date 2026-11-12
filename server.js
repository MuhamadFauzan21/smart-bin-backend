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
INISIALISASI DATABASE
========================================
*/
async function initDatabase() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY,
        email VARCHAR(255) NOT NULL UNIQUE,
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
  weight: 50,
  status: 'NORMAL',
};

/*
========================================
HASH PASSWORD
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
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email dan password harus diisi.',
      });
    }

    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail.includes('@')) {
      return res.status(400).json({
        success: false,
        message: 'Format email tidak valid.',
      });
    }

    if (password.length < 5) {
      return res.status(400).json({
        success: false,
        message: 'Password minimal 5 karakter.',
      });
    }

    const existingUser = await pool.query(
      `
      SELECT id
      FROM users
      WHERE LOWER(email) = LOWER($1)
      `,
      [cleanEmail]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Email sudah terdaftar.',
      });
    }

    const userId = crypto.randomUUID();
    const passwordHash = hashPassword(password);

    await pool.query(
      `
      INSERT INTO users (
        id,
        email,
        password
      )
      VALUES ($1, $2, $3)
      `,
      [
        userId,
        cleanEmail,
        passwordHash,
      ]
    );

    console.log('USER BARU:', {
      id: userId,
      email: cleanEmail,
    });

    return res.status(201).json({
      success: true,
      message: 'Akun berhasil dibuat.',
      user: {
        id: userId,
        email: cleanEmail,
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
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email dan password harus diisi.',
      });
    }

    const cleanEmail = email.trim().toLowerCase();

    const result = await pool.query(
      `
      SELECT id, email, password
      FROM users
      WHERE LOWER(email) = LOWER($1)
      `,
      [cleanEmail]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Email atau password salah.',
      });
    }

    const user = result.rows[0];

    const passwordHash = hashPassword(password);

    if (passwordHash !== user.password) {
      return res.status(401).json({
        success: false,
        message: 'Email atau password salah.',
      });
    }

    console.log(
      'LOGIN BERHASIL:',
      user.email
    );

    return res.json({
      success: true,
      message: 'Login berhasil.',
      user: {
        id: user.id,
        email: user.email,
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
UBAH PASSWORD
========================================
POST /api/auth/change-password
========================================
*/
app.post('/api/auth/change-password', async (req, res) => {
  try {
    const {
      email,
      oldPassword,
      newPassword,
    } = req.body;

    if (
      !email ||
      !oldPassword ||
      !newPassword
    ) {
      return res.status(400).json({
        success: false,
        message: 'Data password belum lengkap.',
      });
    }

    if (newPassword.length < 5) {
      return res.status(400).json({
        success: false,
        message: 'Password baru minimal 5 karakter.',
      });
    }

    const cleanEmail = email.trim().toLowerCase();

    const result = await pool.query(
      `
      SELECT id, email, password
      FROM users
      WHERE LOWER(email) = LOWER($1)
      `,
      [cleanEmail]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Akun tidak ditemukan.',
      });
    }

    const user = result.rows[0];

    const oldPasswordHash =
      hashPassword(oldPassword);

    if (oldPasswordHash !== user.password) {
      return res.status(401).json({
        success: false,
        message: 'Password lama salah.',
      });
    }

    const newPasswordHash =
      hashPassword(newPassword);

    await pool.query(
      `
      UPDATE users
      SET password = $1
      WHERE id = $2
      `,
      [
        newPasswordHash,
        user.id,
      ]
    );

    console.log(
      'PASSWORD BERHASIL DIUBAH:',
      user.email
    );

    return res.json({
      success: true,
      message: 'Password berhasil diubah.',
    });

  } catch (error) {
    console.error(
      'CHANGE PASSWORD ERROR:',
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

// Data berubah setiap 10 detik
setInterval(() => {

  // Kepenuhan naik 5%
  smartBinData.fullness += 5;

  // Berat naik 5 kg
  smartBinData.weight += 5;

  // Jika sudah mencapai 100% dan 100 kg,
  // reset ke kondisi awal
  if (
    smartBinData.fullness >= 100 &&
    smartBinData.weight >= 100
  ) {
    smartBinData.fullness = 0;
    smartBinData.weight = 0;
  }

  // Status mengikuti tingkat kepenuhan
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

}, 10000);

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