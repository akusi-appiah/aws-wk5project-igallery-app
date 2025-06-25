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
  // credentials: {
  //   accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  //   secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  // }
});

const app = express();
app.use(cors());
app.use(express.json());

// Serve static files from "public"
app.use(express.static('public'));

const BUCKET = process.env.S3_BUCKET;
const PORT = process.env.PORT || 3000;

// Log environment variables for debugging
console.log(`Initializing S3 client with region: ${process.env.AWS_REGION}, bucket: ${BUCKET}`);

// Middleware to upload image to S3
const upload = createUploader(BUCKET);

// Ensure bucket exists before starting server
ensureBucket(BUCKET)
  .then(() => {
    console.log(`✅ Successfully verified or created bucket: ${BUCKET}`);

    //Upload endpoint
    app.post("/upload", upload, (req, res) => {
      console.log(`Uploaded image to: ${req.s3Url}`);
      res.json({ url: req.s3Url });
    });

    // 1. GET /images?size=5&token=...
    app.get("/images", async (req, res, next) => {
      try {
        const size = parseInt(req.query.size) || 5;
        const token = req.query.token;
        console.log(`Fetching images from bucket: ${BUCKET}, size: ${size}, token: ${token || 'none'}`);

        const cmd = new ListObjectsV2Command({
          Bucket: BUCKET,
          Prefix: "uploads/",
          MaxKeys: size,
          ContinuationToken: token,
        });
        const data = await s3Client.send(cmd);
        console.log(`Retrieved ${data.Contents?.length || 0} objects from S3`);

        // Generate signed URLs for each image
        const images = await Promise.all(
          (data.Contents || []).map(async item => {
              console.log(`Generating signed URL for key: ${item.Key}`);
              const cmd1 = new GetObjectCommand({ Bucket: BUCKET, Key: item.Key });
              const url = await getSignedUrl(s3Client, cmd1, { expiresIn: 3600 });
              return { key: item.Key, url };
            })
        );

        console.log(`Returning ${images.length} images with signed URLs`);
        res.json({
          images,
          nextToken: data.IsTruncated ? data.NextContinuationToken : undefined,
        });
      } catch (err) {
        console.error(`❌ Failed to setup bucket ${BUCKET}:`, err.message, err.stack);
        next(err);
      }
    });

    // 2. DELETE /images/:key
    app.delete("/images/:key", async (req, res, next) => {
      try {
        const key = decodeURIComponent(req.params.key);
        console.log(`Deleting object from bucket: ${BUCKET}, key: ${key}`);

        const cmd = new DeleteObjectCommand({ Bucket: BUCKET, Key: key });
        await s3Client.send(cmd);
        console.log(`✅ Successfully deleted object: ${key}`);

        res.status(204).end();
      } catch (err) {
        console.error(`❌ Error deleting object ${key} from bucket ${BUCKET}:`, err.message, err.stack);
        next(err);
      }
    });

    // Catch-all route for SPA
    app.get('*', (req, res) => {
      console.log(`Serving SPA index.html for path: ${req.path}`);
      res.sendFile(path.join(__dirname, 'public', 'index.html'));
    });

    // Error handler (must come after all routes)
    app.use((err, _req, res, _next) => {
      console.error(`❌ Server error: ${err.message}`, err.stack);
      res.status(500).json({ error: err.message, details: err.code || 'Unknown' });
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
