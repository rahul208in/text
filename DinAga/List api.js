
import fs from 'fs';
import path from 'path';

export default function handler() {
  try {
    const uploadDir = path.join(process.cwd(), 'public/uploads');
    
    // Log to confirm if the directory exists or is being accessed
    console.log('Accessing /api/files/list route');

    // Ensure the directory exists
    if (!fs.existsSync(uploadDir)) {
      console.log('Uploads directory does not exist. Creating directory...');
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    // Attempt to read files in the directory
    const files = fs.readdirSync(uploadDir);
    console.log('Files in directory:', files); // Log the files found

    // Return the list of files as a JSON array
    return new Response(JSON.stringify(files), { status: 200 });
  } catch (error) {
    console.error('Error reading files:', error); // Log any errors
    // Return an empty array in case of error with status 500
    return new Response(JSON.stringify([]), { status: 500 });
  }
}
