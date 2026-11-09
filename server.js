const express = require('express');
const cors = require('cors');

const app = express();

const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

let smartBinData = {
  id: 'SB-001',
  fullness: 50,
  weight: 2.5,
  status: 'NORMAL',
};

// GET data Smart Bin
app.get('/api/smart-bin', (req, res) => {
  res.json(smartBinData);
});

// POST untuk memperbarui data Smart Bin
app.post('/api/smart-bin', (req, res) => {
  const { id, fullness, weight, status } = req.body;

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

  console.log('Data Smart Bin diperbarui:', smartBinData);

  res.json({
    message: 'Data Smart Bin berhasil diperbarui.',
    data: smartBinData,
  });
});

// SIMULATOR DATA SMART BIN
setInterval(() => {
  smartBinData.fullness += 5;
  smartBinData.weight += 0.5;

  if (smartBinData.fullness >= 90) {
    smartBinData.fullness = 90;
    smartBinData.status = 'WARNING';
  } else if (smartBinData.fullness >= 75) {
    smartBinData.status = 'WARNING';
  } else {
    smartBinData.status = 'NORMAL';
  }

  console.log('Simulator:', smartBinData);
}, 5000);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Smart Bin API berjalan di port ${PORT}`);
});