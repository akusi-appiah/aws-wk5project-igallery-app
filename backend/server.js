// server.js
require("dotenv").config();
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const express = require("express");
const cors = require("cors");
const {S3Client,
  ListObjectsV2Command,
  DeleteObjectCommand,
  GetObjectCommand
} = require("@aws-sdk/client-s3");
const { ensureBucket, createUploader } = require("./services/image-upload");

// Add path module
const path = require('path');

const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  }
});

const app = express();
app.use(cors());
app.use(express.json());

// Serve static files from "public"
app.use(express.static('public'));

const BUCKET = process.env.S3_BUCKET;
const PORT = process.env.PORT || 3000;

// Middleware to upload image to S3
const upload = createUploader(BUCKET);

// Ensure bucket exists before starting server
ensureBucket(BUCKET)
  .then(() => {
    //Upload endpoint
    app.post("/upload", upload, (req, res) => {
      res.json({ url: req.s3Url });
    });

    // 1. GET /images?size=5&token=...
    app.get("/images", async (req, res, next) => {
      try {
        const size = parseInt(req.query.size) || 5;
        const token = req.query.token;

        const cmd = new ListObjectsV2Command({
          Bucket: BUCKET,
          Prefix: "uploads/",
          MaxKeys: size,
          ContinuationToken: token,
        });
        const data = await s3Client.send(cmd);

        // Generate signed URLs for each image
        const images = await Promise.all(
          (data.Contents || []).map(async item => {
              const cmd1 = new GetObjectCommand({ Bucket: BUCKET, Key: item.Key });
              const url = await getSignedUrl(s3Client, cmd1, { expiresIn: 3600 });
              return { key: item.Key, url };
            })
        );

        res.json({
          images,
          nextToken: data.IsTruncated ? data.NextContinuationToken : undefined,
        });
      } catch (err) {
        next(err);
      }
    });

    // 2. DELETE /images/:key
    app.delete("/images/:key", async (req, res, next) => {
      try {
        const key = decodeURIComponent(req.params.key);
        const cmd = new DeleteObjectCommand({ Bucket: BUCKET, Key: key });
        await s3Client.send(cmd);
        res.status(204).end();
      } catch (err) {
        next(err);
      }
    });

    // Catch-all route for SPA
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'public', 'index.html'));
    });

    // Error handler (must come after all routes)
    app.use((err, _req, res, _next) => {
      console.error("❌ Upload error:", err.message);
      res.status(500).json({ error: err.message });
    });

    // Start listening
    app.listen(PORT, () => {
      console.log(`🚀 Backend running at http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("❌ Failed to setup bucket:", err.message);
    process.exit(1);
  });
