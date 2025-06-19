// server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { ensureBucket, createUploader } = require('./services/image-upload');

const app = express();
app.use(cors());
app.use(express.json());

const BUCKET = process.env.S3_BUCKET;
const PORT = process.env.PORT || 3000;

// Middleware to upload image to S3
const upload = createUploader(BUCKET);

// Ensure bucket exists before starting server
ensureBucket(BUCKET)
  .then(() => {
    app.post('/upload',  upload, (req, res) => {
      res.json({ url: req.s3Url });
    });

    app.use((err, _req, res, _next) => {
      console.error('❌ Upload error:', err.message);
      res.status(500).json({ error: err.message });
    });

    app.listen(PORT, () => {
      console.log(`🚀 Backend running at http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('❌ Failed to setup bucket:', err.message);
    process.exit(1);
  });


