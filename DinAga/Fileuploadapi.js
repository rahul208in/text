
import fs from 'fs';
import path from 'path';
import multiparty from 'multiparty';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  const uploadDir = path.join(process.cwd(), 'public/uploads');
  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

  const form = new multiparty.Form({ uploadDir: uploadDir });

  form.parse(req, (err, fields, files) => {
    if (err) {
      console.error('File upload error:', err);
      res.status(500).json({ error: 'File upload error' });
      return;
    }

    const uploadedFile = files.file[0];
    const filePath = uploadedFile.path;
    const fileName = path.basename(filePath);

    res.status(200).json({ fileName });
  });
}
