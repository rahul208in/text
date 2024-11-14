
import fs from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';
import Busboy from 'busboy';

export const config = {
  api: {
    bodyParser: false, // Disable body parsing to handle file uploads
  },
};

export async function POST(req) {
  return new Promise((resolve, reject) => {
    const busboy = new Busboy({ headers: req.headers });
    const uploadDir = path.join(process.cwd(), 'public', 'upload');

    // Ensure upload directory exists
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    let uploadFilePath = '';
    busboy.on('file', (fieldname, file, filename) => {
      uploadFilePath = path.join(uploadDir, filename);
      const writeStream = fs.createWriteStream(uploadFilePath);
      file.pipe(writeStream);
      file.on('end', () => {
        console.log(`File [${fieldname}] uploaded to ${uploadFilePath}`);
      });
    });

    busboy.on('finish', () => {
      resolve(
        NextResponse.json({
          message: 'File uploaded successfully',
          filePath: uploadFilePath,
        })
      );
    });

    busboy.on('error', (error) => {
      console.error("Upload error:", error);
      reject(
        NextResponse.json(
          { error: 'File upload failed', details: error.message },
          { status: 500 }
        )
      );
    });

    req.body.pipe(busboy);
  });
}
