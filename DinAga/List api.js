
import fs from 'fs';
import path from 'path';

export default function handler() {
  const uploadDir = path.join(process.cwd(), 'public/uploads');
  
  // Ensure the directory exists
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const files = fs.readdirSync(uploadDir) || [];
  return new Response(JSON.stringify(files), { status: 200 });
}
