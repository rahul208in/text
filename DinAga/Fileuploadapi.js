
import fs from 'fs';
import path from 'path';
import Busboy from 'busboy';

export const config = {
  api: {
    bodyParser: false,
  },
};

export async function POST(req) {
  return new Promise((resolve, reject) => {
    try {
      const uploadDir = path.join(process.cwd(), 'public/uploads');
      if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

      const busboy = new Busboy({ headers: req.headers });
      const filePaths = [];

      busboy.on('file', (fieldname, file, filename) => {
        const saveTo = path.join(uploadDir, filename);
        file.pipe(fs.createWriteStream(saveTo));
        filePaths.push(saveTo);
      });

      busboy.on('finish', () => {
        resolve(new Response(JSON.stringify({ filePaths }), { status: 200 }));
      });

      busboy.on('error', (error) => {
        console.error('File upload error:', error);
        reject(new Response(JSON.stringify({ error: 'File upload error' }), { status: 500 }));
      });

      req.pipe(busboy);
    } catch (error) {
      console.error('Unexpected error:', error);
      reject(new Response(JSON.stringify({ error: 'Unexpected error' }), { status: 500 }));
    }
  });
}
