
import fs from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';
import { IncomingForm } from 'formidable';

export const config = {
  api: {
    bodyParser: false, // Disable default body parsing to handle file uploads
  },
};

export async function POST(req) {
  try {
    const { fields, files } = await parseFormData(req);

    if (!files || !files.vulReport) {
      return NextResponse.json({ error: 'File is required' }, { status: 400 });
    }

    // Define the upload directory
    const uploadDir = path.join(process.cwd(), 'public', 'upload');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    // Save the uploaded file to the upload directory
    const file = files.vulReport[0];
    const filePath = path.join(uploadDir, file.originalFilename);
    fs.renameSync(file.filepath, filePath);

    // Send success response
    return NextResponse.json({ message: 'File uploaded successfully', filePath });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json({ error: 'File upload failed' }, { status: 500 });
  }
}

// Helper function to parse form data
function parseFormData(req) {
  return new Promise((resolve, reject) => {
    const form = new IncomingForm();
    form.uploadDir = path.join(process.cwd(), 'tmp'); // Temporary directory for file storage
    form.keepExtensions = true;

    form.parse(req, (err, fields, files) => {
      if (err) {
        console.error("Form parse error:", err);
        reject(err);
      }
      resolve({ fields, files });
    });
  });
}
