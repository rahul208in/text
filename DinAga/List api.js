
import fs from 'fs';
import path from 'path';

export default function handler() {
  try {
    const uploadDir = path.join(process.cwd(), 'public/uploads');
    
    // Ensure the directory exists
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const files = fs.readdirSync(uploadDir);
    return new Response(JSON.stringify(files), { status: 200 });
  } catch (error) {
    // Return an empty array if there's an error
    return new Response(JSON.stringify([]), { status: 500 });
  }
}
