const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const cors = require('cors');
const fs = require('fs');

const app = express();
app.use(express.json());
app.use(cors());

const JWT_SECRET  = process.env.JWT_SECRET  || 'dev-secret-change-in-production';
const MONGO_URI   = process.env.MONGO_URI   || 'mongodb://localhost:27017/diary-entries';
const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(__dirname, '..', 'uploads');
const PORT        = process.env.PORT        || 3002;

fs.mkdirSync(UPLOADS_DIR, { recursive: true });

app.use('/uploads', express.static(UPLOADS_DIR));

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, unique + path.extname(file.originalname).toLowerCase());
  },
});

const upload = multer({
  storage,
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
      if (req.file) fs.unlink(req.file.path, () => {});
      return res.status(400).json({ error: 'title and body are required' });
    }

    const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;

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

    if (entry.imageUrl) {
      const filePath = path.join(UPLOADS_DIR, path.basename(entry.imageUrl));
      fs.unlink(filePath, () => {});
    }

    res.json({ message: 'Entry deleted' });
  } catch (err) {
    console.error('Delete entry error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(PORT, () => console.log(`Diary service listening on port ${PORT}`));
