import { Router } from 'express';
import multer from 'multer';
import { v4 as uuid } from 'uuid';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { getDB } from '../db/database.js';
import { requireAuth } from '../middleware/auth.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const router = Router();

router.use(requireAuth);

const ALLOWED_MIMES = new Set([
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'text/plain', 'text/markdown', 'text/csv', 'text/html', 'text/css',
  'application/json', 'application/xml',
]);

const ALLOWED_EXTENSIONS = /\.(jpg|jpeg|png|gif|webp|svg|pdf|docx|doc|txt|md|csv|html|css|json|xml|js|ts|py)$/i;

const storage = multer.diskStorage({
  destination: join(__dirname, '../../../uploads'),
  filename: (req, file, cb) => {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${uuid()}-${safeName}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIMES.has(file.mimetype) || ALLOWED_EXTENSIONS.test(file.originalname)) {
      cb(null, true);
    } else {
      cb(new Error(`File type not allowed: ${file.mimetype}`), false);
    }
  }
});

router.post('/upload', upload.array('files', 10), async (req, res) => {
  const db = getDB();
  const { conversation_id } = req.body;
  const results = [];

  for (const file of req.files) {
    let text = '';
    try {
      if (file.mimetype === 'application/pdf') {
        const pdfParse = (await import('pdf-parse/lib/pdf-parse.js')).default;
        const { readFileSync } = await import('fs');
        const dataBuffer = readFileSync(file.path);
        const data = await pdfParse(dataBuffer);
        text = data.text;
      } else if (file.mimetype.includes('wordprocessingml') || file.originalname.endsWith('.docx')) {
        const mammoth = (await import('mammoth')).default;
        const result = await mammoth.extractRawText({ path: file.path });
        text = result.value;
      } else if (file.mimetype.startsWith('text/') || file.originalname.match(/\.(txt|md|js|ts|py|json|csv|xml|html|css)$/)) {
        const { readFileSync } = await import('fs');
        text = readFileSync(file.path, 'utf-8');
      }
    } catch (err) {
      console.error('File parse error:', err);
    }

    if (text && conversation_id) {
      const chunks = chunkText(text, 2000);
      for (let i = 0; i < chunks.length; i++) {
        db.prepare(`
          INSERT INTO documents (id, conversation_id, filename, content, chunk_index)
          VALUES (?, ?, ?, ?, ?)
        `).run(uuid(), conversation_id, file.originalname, chunks[i], i);
      }
    }

    let base64 = null;
    if (file.mimetype.startsWith('image/')) {
      const { readFileSync } = await import('fs');
      base64 = readFileSync(file.path).toString('base64');
    }

    results.push({
      id: uuid(),
      filename: file.originalname,
      path: `/uploads/${file.filename}`,
      mimetype: file.mimetype,
      size: file.size,
      base64,
      text_extracted: text.length > 0,
      text_preview: text.slice(0, 200)
    });
  }

  res.json(results);
});

function chunkText(text, chunkSize) {
  const chunks = [];
  for (let i = 0; i < text.length; i += chunkSize) {
    chunks.push(text.slice(i, i + chunkSize));
  }
  return chunks;
}

router.get('/documents/:conversation_id', (req, res) => {
  const db = getDB();
  const docs = db.prepare(`
    SELECT DISTINCT filename, conversation_id, MIN(created_at) as created_at, COUNT(*) as chunks
    FROM documents WHERE conversation_id = ?
    GROUP BY filename
  `).all(req.params.conversation_id);
  res.json(docs);
});

router.get('/search/:conversation_id', (req, res) => {
  const db = getDB();
  const { q } = req.query;
  if (!q) return res.json([]);
  const docs = db.prepare(`
    SELECT * FROM documents WHERE conversation_id = ? AND content LIKE ? LIMIT 5
  `).all(req.params.conversation_id, `%${q}%`);
  res.json(docs);
});

export default router;
