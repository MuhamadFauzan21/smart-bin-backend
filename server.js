const express = require('express');
const cors = require('cors');
const crypto = require('crypto');

const app = express();

const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

/*
========================================
DATA AKUN
========================================
Untuk tahap pengembangan.
Nanti bisa kita pindahkan ke database cloud.
*/
const users = [];

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
app.post('/api/auth/register', (req, res) => {
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

  const existingUser = users.find(
    (user) =>
      user.username.toLowerCase() ===
      cleanUsername.toLowerCase()
  );

  if (existingUser) {
    return res.status(409).json({
      success: false,
      message: 'Username sudah digunakan.',
    });
  }

  const newUser = {
    id: crypto.randomUUID(),
    username: cleanUsername,
    password: hashPassword(password),
  };

  users.push(newUser);

  console.log('USER BARU:', {
    id: newUser.id,
    username: newUser.username,
  });

  return res.status(201).json({
    success: true,
    message: 'Akun berhasil dibuat.',
    user: {
      id: newUser.id,
      username: newUser.username,
    },
  });
});

/*
========================================
LOGIN
========================================
POST /api/auth/login
========================================
*/
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({
      success: false,
      message: 'Username dan password harus diisi.',
    });
  }

  const user = users.find(
    (user) =>
      user.username.toLowerCase() ===
      username.trim().toLowerCase()
  );

  if (!user) {
    return res.status(401).json({
      success: false,
      message: 'Username atau password salah.',
    });
  }

  const passwordHash = hashPassword(password);

  if (passwordHash !== user.password) {
    return res.status(401).json({
      success: false,
      message: 'Username atau password salah.',
    });
  }

  console.log('LOGIN BERHASIL:', user.username);

  return res.json({
    success: true,
    message: 'Login berhasil.',
    user: {
      id: user.id,
      username: user.username,
    },
  });
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
    smartBinData.status = 'DAPAT DIANGKUT';
  } else {
    smartBinData.status = 'NORMAL';
  }

  console.log('Simulator:', smartBinData);
}, 5000);

/*
========================================
START SERVER
========================================
*/
app.listen(PORT, '0.0.0.0', () => {
  console.log(
    `Smart Bin API berjalan di port ${PORT}`
  );
});