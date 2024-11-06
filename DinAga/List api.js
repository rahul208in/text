
import fs from 'fs';
import path from 'path';

export default function handler(req, res) {
  const uploadDir = path.join(process.cwd(), '/public/uploads');
  const files = fs.readdirSync(uploadDir);
  res.status(200).json(files);
}
