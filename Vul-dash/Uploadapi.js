
import fs from 'fs';
import path from 'path';

export const config = {
  api: {
    bodyParser: false, // Disable default body parsing so we can handle file upload
  },
};

export default async function handler(req, res) {
  if (req.method === 'POST') {
    try {
      const { fields, files } = await parseFormData(req);

      if (!files || !files.vulReport) {
        return res.status(400).json({ error: 'File is required' });
      }

      // Define upload directory
      const uploadDir = path.join(process.cwd(), 'public', 'upload');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      // Save the uploaded file to the upload directory
      const file = files.vulReport[0];
      const filePath = path.join(uploadDir, file.originalFilename);
      fs.renameSync(file.filepath, filePath);

      // Send success response
      res.status(200).json({ message: 'File uploaded successfully', filePath });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'File upload failed' });
    }
  } else {
    res.setHeader('Allow', ['POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}

// Helper function to parse form data
import formidable from 'formidable';
function parseFormData(req) {
  return new Promise((resolve, reject) => {
    const form = new formidable.IncomingForm();
    form.uploadDir = path.join(process.cwd(), 'tmp'); // Temporary upload location
    form.keepExtensions = true;

    form.parse(req, (err, fields, files) => {
      if (err) reject(err);
      resolve({ fields, files });
    });
  });
}
