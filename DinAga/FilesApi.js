
import fs from 'fs';
import path from 'path';
import formidable from 'formidable';

export const config = {
  api: {
    bodyParser: false,
  },
};

const uploadDir = path.join(process.cwd(), '/public/uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

export default async function handler(req, res) {
  if (req.method === 'POST') {
    const form = new formidable.IncomingForm();
    form.uploadDir = uploadDir;
    form.keepExtensions = true;

    form.parse(req, (err, fields, files) => {
      if (err) return res.status(500).json({ error: 'File upload error' });
      const filePath = files.file.path;
      const fileName = path.basename(filePath);
      res.status(200).json({ fileName });
    });
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}
