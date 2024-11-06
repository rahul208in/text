
import fs from 'fs';
import path from 'path';

export default function handler() {
  try {
    const uploadDir = path.join(process.cwd(), 'public/uploads');
    
    // Log to verify if this route is accessed
    console.log('Accessing /api/files/list');

    // Ensure the directory exists
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const files = fs.readdirSync(uploadDir);
    console.log('Files in directory:', files); // Log the files found

    return new Response(JSON.stringify(files), { status: 200 });
  } catch (error) {
    console.error('Error reading files:', error);
    // Return an empty array if there's an error
    return new Response(JSON.stringify([]), { status: 500 });
  }
}
