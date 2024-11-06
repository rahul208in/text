
import fs from 'fs';
import path from 'path';

// Use require to import formidable to avoid Webpack issues
const formidable = require('formidable');

export const config = {
  api: {
    bodyParser: false,
  },
};

export async function POST(req) {
  const uploadDir = path.join(process.cwd(), 'public/uploads');
  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

  const form = formidable({
    uploadDir: uploadDir,
    keepExtensions: true,
  });

  return new Promise((resolve, reject) => {
    form.parse(req, (err, fields, files) => {
      if (err) {
        console.error('File upload error:', err);
        reject(new Response(JSON.stringify({ error: 'File upload error' }), { status: 500 }));
      }
      
      const filePath = files.file.filepath;
      const fileName = path.basename(filePath);
      resolve(new Response(JSON.stringify({ fileName }), { status: 200 }));
    });
  });
}
