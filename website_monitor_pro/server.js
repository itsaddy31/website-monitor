const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;

// Serve public UI
app.use(express.static(path.join(__dirname, 'public')));

// API: get monitors
app.get('/api/monitors', (req, res) => {
  const file = path.join(__dirname, 'websites.json');

  fs.readFile(file, 'utf8', (err, data) => {
    if (err) {
      return res.json([]);
    }

    try {
      const monitors = JSON.parse(data);
      res.json(monitors);
    } catch {
      res.json([]);
    }
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`2A Monitoring running → http://localhost:${PORT}`);
});
