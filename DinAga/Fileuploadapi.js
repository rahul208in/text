
import fs from 'fs';
import path from 'path';
import formidable from 'formidable';

export const config = {
  api: {
    bodyParser: false,
  },
};

const uploadDir = path.join(process.cwd(), 'public/uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

export default async function handler(req) {
  if (req.method === 'POST') {
    const form = new formidable.IncomingForm();
    form.uploadDir = uploadDir;
    form.keepExtensions = true;

    return new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject({ error: 'File upload error' });
        const filePath = files.file.path;
        const fileName = path.basename(filePath);
        resolve(new Response(JSON.stringify({ fileName }), { status: 200 }));
      });
    });
  } else {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }
}
