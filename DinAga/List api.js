
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
    try {
        const uploadsDir = path.join(process.cwd(), 'public/uploads');
        
        // Read the files in the uploads directory
        const files = fs.readdirSync(uploadsDir);
        
        return NextResponse.json({ files }, { status: 200 });
    } catch (error) {
        console.error('Error reading upload directory:', error);
        return NextResponse.json({ error: 'Unable to list files' }, { status: 500 });
    }
}
