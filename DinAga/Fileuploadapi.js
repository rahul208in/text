
import fs from 'fs';
import path from 'path';
import multiparty from 'multiparty';

export const config = {
  api: {
    bodyParser: false,
  },
};

export async function POST(req) {
  return new Promise((resolve, reject) => {
    const uploadDir = path.join(process.cwd(), 'public/uploads');
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

    const form = new multiparty.Form({ uploadDir: uploadDir });

    form.parse(req, (err, fields, files) => {
      if (err) {
        console.error('File upload error:', err);
        resolve(new Response(JSON.stringify({ error: 'File upload error' }), { status: 500 }));
        return;
      }

      const uploadedFile = files.file[0];
      const filePath = uploadedFile.path;
      const fileName = path.basename(filePath);

      resolve(new Response(JSON.stringify({ fileName }), { status: 200 }));
    });
  });
}
