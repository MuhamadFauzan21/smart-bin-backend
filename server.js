const express = require('express');
const cors = require('cors');

const app = express();

const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const smartBinData = {
  id: 'SB-001',
  fullness: 50,
  weight: 2.5,
  status: 'NORMAL',
};

app.get('/api/smart-bin', (req, res) => {
  res.json(smartBinData);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Smart Bin API berjalan di port ${PORT}`);
});