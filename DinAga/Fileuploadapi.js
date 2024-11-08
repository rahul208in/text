
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function POST(req) {
    try {
        // Parse the FormData from the request
        const formData = await req.formData();
        const file = formData.get('file');

        // Check if file is provided
        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 });
        }

        // Convert Blob to Buffer
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Define the file path where the file will be saved
        const uploadsDir = path.join(process.cwd(), 'public/uploads');
        const filePath = path.join(uploadsDir, file.name);

        // Ensure the uploads directory exists
        if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir, { recursive: true });
        }

        // Write the file to the server
        fs.writeFileSync(filePath, buffer);

        // Return a success response
        return NextResponse.json({ message: 'File uploaded successfully' }, { status: 200 });
    } catch (error) {
        console.error('File upload error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
