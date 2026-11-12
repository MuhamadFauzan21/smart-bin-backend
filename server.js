const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const { Pool } = require('pg');
const { Resend } = require('resend');

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

const resend = new Resend(
  process.env.RESEND_API_KEY
);

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
INIT DATABASE
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

    console.log('DATABASE SIAP');
  } catch (error) {
    console.error(
      'DATABASE INIT ERROR:',
      error.message
    );
  }
}

/*
========================================
REGISTER
========================================
*/

app.post('/api/auth/register', async (req, res) => {
  try {
    const {
      email,
      password,
    } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email dan password harus diisi.',
      });
    }

    const cleanEmail =
      email.trim().toLowerCase();

    if (!cleanEmail.includes('@')) {
      return res.status(400).json({
        success: false,
        message: 'Email tidak valid.',
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

    const userId =
      crypto.randomUUID();

    const passwordHash =
      hashPassword(password);

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

    console.log(
      'USER BERHASIL DIBUAT:',
      cleanEmail
    );

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
*/

app.post('/api/auth/login', async (req, res) => {
  try {
    const {
      email,
      password,
    } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email dan password harus diisi.',
      });
    }

    const cleanEmail =
      email.trim().toLowerCase();

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

    const passwordHash =
      hashPassword(password);

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
CHANGE PASSWORD
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

    const cleanEmail =
      email.trim().toLowerCase();

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
FORGOT PASSWORD
========================================
*/

app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email harus diisi.',
      });
    }

    const cleanEmail =
      email.trim().toLowerCase();

    const result = await pool.query(
      `
      SELECT id, email
      FROM users
      WHERE LOWER(email) = LOWER($1)
      `,
      [cleanEmail]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Email tidak terdaftar.',
      });
    }

    /*
    ========================================
    KIRIM EMAIL RESET PASSWORD
    ========================================
    */

    const { data, error } = await resend.emails.send({
      from: 'Smart Bin <onboarding@resend.dev>',
      to: [cleanEmail],
      subject: 'Reset Password Smart Bin',
      html: `
        <div style="font-family: Arial, sans-serif;">
          <h2>Reset Password Smart Bin</h2>

          <p>
            Kami menerima permintaan untuk mereset
            password akun Smart Bin kamu.
          </p>

          <p>
            Untuk melanjutkan proses reset password,
            silakan gunakan fitur reset password
            pada aplikasi Smart Bin.
          </p>

          <p>
            Jika kamu tidak melakukan permintaan ini,
            abaikan email ini.
          </p>

          <br>

          <p>
            Terima kasih,<br>
            <strong>Smart Bin</strong>
          </p>
        </div>
      `,
    });

    if (error) {
      console.error(
        'RESEND EMAIL ERROR:',
        error
      );

      return res.status(500).json({
        success: false,
        message: 'Email reset password gagal dikirim.',
      });
    }

    console.log(
      'EMAIL RESET PASSWORD BERHASIL DIKIRIM:',
      cleanEmail
    );

    console.log(
      'RESEND EMAIL ID:',
      data?.id
    );

    return res.json({
      success: true,
      message: 'Email reset password berhasil dikirim.',
    });

  } catch (error) {
    console.error(
      'DATABASE INIT ERROR:',
      error
    );

    return res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan pada server.',
    });
  }
});

/*
========================================
SMART BIN
========================================
*/

app.get('/api/smartbin', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT *
      FROM smart_bins
      ORDER BY created_at DESC
    `);

    return res.json({
      success: true,
      data: result.rows,
    });

  } catch (error) {
    console.error(
      'GET SMART BIN ERROR:',
      error.message
    );

    return res.status(500).json({
      success: false,
      message: 'Gagal mengambil data Smart Bin.',
    });
  }
});

app.post('/api/smartbin', async (req, res) => {
  try {
    const {
      bin_id,
      fullness,
      weight,
      status,
    } = req.body;

    const result = await pool.query(
      `
      INSERT INTO smart_bins (
        bin_id,
        fullness,
        weight,
        status
      )
      VALUES ($1, $2, $3, $4)
      RETURNING *
      `,
      [
        bin_id,
        fullness,
        weight,
        status,
      ]
    );

    return res.status(201).json({
      success: true,
      data: result.rows[0],
    });

  } catch (error) {
    console.error(
      'POST SMART BIN ERROR:',
      error.message
    );

    return res.status(500).json({
      success: false,
      message: 'Gagal menyimpan data Smart Bin.',
    });
  }
});

/*
========================================
SIMULATOR
========================================
*/

app.post('/api/simulator', async (req, res) => {
  try {
    const {
      bin_id,
      fullness,
      weight,
      status,
    } = req.body;

    console.log(
      'SIMULATOR DATA:',
      {
        bin_id,
        fullness,
        weight,
        status,
      }
    );

    return res.json({
      success: true,
      message: 'Data simulator diterima.',
    });

  } catch (error) {
    console.error(
      'SIMULATOR ERROR:',
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
START SERVER
========================================
*/

initDatabase()
  .then(() => {
    app.listen(PORT, () => {
      console.log(
        `SERVER BERJALAN DI PORT ${PORT}`
      );
    });
  })
  .catch((error) => {
    console.error(
      'SERVER GAGAL DIJALANKAN:',
      error.message
    );
  });