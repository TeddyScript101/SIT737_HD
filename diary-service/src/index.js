const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const cors = require('cors');
const { Storage } = require('@google-cloud/storage');

const app = express();
app.use(express.json());
app.use(cors());

const JWT_SECRET      = process.env.JWT_SECRET      || 'dev-secret-change-in-production';
const MONGO_URI       = process.env.MONGO_URI       || 'mongodb://localhost:27017/diary-entries';
const GCS_BUCKET_NAME = process.env.GCS_BUCKET_NAME || '';
const PORT            = process.env.PORT            || 3002;

// GCS client — uses GOOGLE_APPLICATION_CREDENTIALS env var when set,
// falls back to ADC for local development
const gcsClient = new Storage();
const bucket    = GCS_BUCKET_NAME ? gcsClient.bucket(GCS_BUCKET_NAME) : null;

async function uploadToGCS(file) {
  const ext      = path.extname(file.originalname).toLowerCase();
  const filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
  const blob     = bucket.file(filename);
  await blob.save(file.buffer, { contentType: file.mimetype });
  // Return the same /uploads/filename path format as before so the frontend
  // and Nginx proxy config need no changes.
  return `/uploads/${filename}`;
}

async function deleteFromGCS(imageUrl) {
  // imageUrl is stored as /uploads/filename
  const filename = path.basename(imageUrl);
  await bucket.file(filename).delete();
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp/;
    const okExt  = allowed.test(path.extname(file.originalname).toLowerCase());
    const okMime = allowed.test(file.mimetype);
    if (okExt && okMime) cb(null, true);
    else cb(new Error('Only JPEG, PNG, GIF, and WebP images are allowed'), false);
  },
});

const entrySchema = new mongoose.Schema({
  userId:    { type: String, required: true, index: true },
  username:  { type: String, required: true },
  title:     { type: String, required: true, trim: true },
  body:      { type: String, required: true },
  imageUrl:  { type: String, default: null },
  createdAt: { type: Date, default: Date.now },
});

const Entry = mongoose.model('Entry', entrySchema);

mongoose
  .connect(MONGO_URI)
  .then(() => console.log('Diary service connected to MongoDB'))
  .catch((err) => { console.error('MongoDB error:', err); process.exit(1); });

function authenticate(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }
  try {
    req.user = jwt.verify(auth.slice(7), JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Token is invalid or expired' });
  }
}

function handleUpload(req, res, next) {
  upload.single('image')(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ error: `Upload error: ${err.message}` });
    } else if (err) {
      return res.status(400).json({ error: err.message });
    }
    next();
  });
}

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'diary' }));

// Stream images from GCS — keeps the same /uploads/:filename URL shape as before
app.get('/uploads/:filename', async (req, res) => {
  if (!bucket) return res.status(503).json({ error: 'Storage not configured' });
  try {
    const file = bucket.file(req.params.filename);
    const [metadata] = await file.getMetadata();
    res.setHeader('Content-Type', metadata.contentType || 'application/octet-stream');
    file.createReadStream()
      .on('error', () => res.status(404).end())
      .pipe(res);
  } catch {
    res.status(404).end();
  }
});

app.get('/entries', authenticate, async (req, res) => {
  try {
    const entries = await Entry.find({ userId: req.user.userId })
      .sort({ createdAt: -1 })
      .select('-__v');
    res.json(entries);
  } catch (err) {
    console.error('Get entries error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/entries/:id', authenticate, async (req, res) => {
  try {
    const entry = await Entry.findOne({ _id: req.params.id, userId: req.user.userId });
    if (!entry) return res.status(404).json({ error: 'Entry not found' });
    res.json(entry);
  } catch (err) {
    console.error('Get entry error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/entries', authenticate, handleUpload, async (req, res) => {
  try {
    const { title, body } = req.body;
    if (!title || !body) {
      return res.status(400).json({ error: 'title and body are required' });
    }

    let imageUrl = null;
    if (req.file && bucket) {
      imageUrl = await uploadToGCS(req.file);
    }

    const entry = await Entry.create({
      userId: req.user.userId,
      username: req.user.username,
      title,
      body,
      imageUrl,
    });

    res.status(201).json(entry);
  } catch (err) {
    console.error('Create entry error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/entries/:id', authenticate, async (req, res) => {
  try {
    const entry = await Entry.findOneAndDelete({ _id: req.params.id, userId: req.user.userId });
    if (!entry) return res.status(404).json({ error: 'Entry not found' });

    if (entry.imageUrl && bucket) {
      await deleteFromGCS(entry.imageUrl).catch((err) =>
        console.error('GCS delete failed (continuing):', err.message)
      );
    }

    res.json({ message: 'Entry deleted' });
  } catch (err) {
    console.error('Delete entry error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(PORT, () => console.log(`Diary service listening on port ${PORT}`));
