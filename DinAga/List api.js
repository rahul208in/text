
import fs from 'fs';
import path from 'path';

export default function handler() {
  const uploadDir = path.join(process.cwd(), 'public/uploads');
  const files = fs.readdirSync(uploadDir);
  return new Response(JSON.stringify(files), { status: 200 });
}
