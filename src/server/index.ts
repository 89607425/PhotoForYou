import './polyfill';
import express from 'express';
import multer from 'multer';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import sharp from 'sharp';
import imghash from 'imghash';
import { v4 as uuidv4 } from 'uuid';
import archiver from 'archiver';
import { initFaceDetection, detectFacesBatch, type FaceAnalysisResult } from './faceDetection';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '100mb' }));

const UPLOADS_DIR = path.join(process.cwd(), 'uploads');

interface PhotoRecord {
  id: string;
  sessionId: string;
  originalName: string;
  originalPath: string;
  thumbPath: string;
  mimeType: string;
  size: number;
}

const sessions = new Map<string, PhotoRecord[]>();

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const sessionId = req.params.sessionId || 'default';
      const dir = path.join(UPLOADS_DIR, sessionId, 'originals');
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (req, file, cb) => {
      const id = uuidv4();
      const ext = path.extname(file.originalname);
      cb(null, `${id}${ext}`);
    },
  }),
  fileFilter: (req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.heic', '.heif', '.webp'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${ext}`));
    }
  },
  limits: { fileSize: 100 * 1024 * 1024 },
});

app.post('/api/sessions', (req, res) => {
  const sessionId = uuidv4();
  sessions.set(sessionId, []);
  res.json({ sessionId });
});

app.post('/api/sessions/:sessionId/upload', upload.array('photos', 200), async (req, res) => {
  const { sessionId } = req.params;
  const files = req.files as Express.Multer.File[];
  if (!files || files.length === 0) {
    return res.status(400).json({ error: 'No files uploaded' });
  }

  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, []);
  }

  const thumbDir = path.join(UPLOADS_DIR, sessionId, 'thumbnails');
  fs.mkdirSync(thumbDir, { recursive: true });

  const photos: PhotoRecord[] = [];

  for (const file of files) {
    const photoId = path.basename(file.filename, path.extname(file.filename));
    const thumbName = `${photoId}.webp`;
    const thumbPath = path.join(thumbDir, thumbName);

    try {
      await sharp(file.path)
        .resize(400, 400, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 80 })
        .toFile(thumbPath);
    } catch (err) {
      console.error(`Thumbnail generation failed for ${file.originalname}:`, err);
      continue;
    }

    const record: PhotoRecord = {
      id: photoId,
      sessionId,
      originalName: file.originalname,
      originalPath: file.path,
      thumbPath,
      mimeType: file.mimetype,
      size: file.size,
    };
    photos.push(record);
  }

  sessions.get(sessionId)!.push(...photos);

  const result = photos.map((p) => ({
    id: p.id,
    name: p.originalName,
    size: p.size,
    thumbnailUrl: `/api/sessions/${sessionId}/photos/${p.id}/thumbnail`,
    mediumUrl: `/api/sessions/${sessionId}/photos/${p.id}/medium`,
    fullUrl: `/api/sessions/${sessionId}/photos/${p.id}/full`,
  }));

  res.json({ success: true, photos: result, count: result.length });
});

app.get('/api/sessions/:sessionId/photos/:photoId/thumbnail', (req, res) => {
  const { sessionId, photoId } = req.params;
  const thumbPath = path.join(UPLOADS_DIR, sessionId, 'thumbnails', `${photoId}.webp`);
  if (fs.existsSync(thumbPath)) {
    res.setHeader('Cache-Control', 'public, max-age=31536000');
    res.sendFile(thumbPath);
  } else {
    res.status(404).json({ error: 'Thumbnail not found' });
  }
});

app.get('/api/sessions/:sessionId/photos/:photoId/medium', async (req, res) => {
  const { sessionId, photoId } = req.params;
  const sessionPhotos = sessions.get(sessionId);
  const photo = sessionPhotos?.find((p) => p.id === photoId);
  if (!photo || !fs.existsSync(photo.originalPath)) {
    return res.status(404).json({ error: 'Photo not found' });
  }

  try {
    const buffer = await sharp(photo.originalPath)
      .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer();
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate medium image' });
  }
});

app.get('/api/sessions/:sessionId/photos/:photoId/full', (req, res) => {
  const { sessionId, photoId } = req.params;
  const sessionPhotos = sessions.get(sessionId);
  const photo = sessionPhotos?.find((p) => p.id === photoId);
  if (!photo || !fs.existsSync(photo.originalPath)) {
    return res.status(404).json({ error: 'Photo not found' });
  }
  res.sendFile(photo.originalPath);
});

app.post('/api/sessions/:sessionId/analyze', async (req, res) => {
  const { sessionId } = req.params;
  const sessionPhotos = sessions.get(sessionId);
  if (!sessionPhotos || sessionPhotos.length === 0) {
    return res.status(404).json({ error: 'No photos found in session' });
  }

  try {
    const filePaths = sessionPhotos.map((p) => p.originalPath);
    const results = await detectFacesBatch(filePaths);

    const faceResults = sessionPhotos.map((photo, i) => ({
      photoId: photo.id,
      faceData: results[i],
    }));

    res.json({ success: true, results: faceResults });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/sessions/:sessionId/compute-hash/:photoId', async (req, res) => {
  const { sessionId, photoId } = req.params;
  const sessionPhotos = sessions.get(sessionId);
  const photo = sessionPhotos?.find((p) => p.id === photoId);
  if (!photo || !fs.existsSync(photo.originalPath)) {
    return res.status(404).json({ error: 'Photo not found' });
  }

  try {
    const hash = await imghash.hash(photo.originalPath);
    res.json({ success: true, hash });
  } catch (err: any) {
    res.json({ success: false, error: err.message });
  }
});

app.post('/api/sessions/:sessionId/export', (req, res) => {
  const { sessionId } = req.params;
  const { photoIds } = req.body as { photoIds: string[] };
  if (!photoIds || photoIds.length === 0) {
    return res.status(400).json({ error: 'No photos to export' });
  }

  const sessionPhotos = sessions.get(sessionId);
  if (!sessionPhotos) {
    return res.status(404).json({ error: 'Session not found' });
  }

  const toExport = sessionPhotos.filter((p) => photoIds.includes(p.id));
  if (toExport.length === 0) {
    return res.status(400).json({ error: 'No matching photos found' });
  }

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="photoforyou-export-${Date.now()}.zip"`);

  const archive = archiver('zip', { zlib: { level: 5 } });
  archive.on('error', (err) => { res.status(500).send({ error: err.message }); });
  archive.pipe(res);

  toExport.forEach((photo, i) => {
    const name = photo.originalName;
    archive.file(photo.originalPath, { name: `${String(i + 1).padStart(3, '0')}_${name}` });
  });

  archive.finalize();
});

async function start() {
  try {
    await initFaceDetection();
    console.log('Face detection initialized');
  } catch (err) {
    console.warn('Face detection init failed (will skip face analysis):', err);
  }

  app.listen(PORT, () => {
    console.log(`PhotoForYou server running at http://localhost:${PORT}`);
  });
}

start();
