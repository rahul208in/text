
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import * as XLSX from 'xlsx';

export async function GET() {
    try {
        const uploadsDir = path.join(process.cwd(), 'public/uploads');

        // Find the most recent .xlsx file in the uploads directory
        const files = fs.readdirSync(uploadsDir).filter(file => file.endsWith('.xlsx'));
        if (files.length === 0) {
            return NextResponse.json({ error: 'No XLSX file found' }, { status: 404 });
        }

        // Assume the first file is the one to parse (or select based on your criteria)
        const filePath = path.join(uploadsDir, files[0]);

        // Read and parse the XLSX file
        const workbook = XLSX.readFile(filePath);
        const sheetsData = {};

        // Loop through each sheet in the workbook
        workbook.SheetNames.forEach(sheetName => {
            const worksheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

            // Extract headers and rows
            const headers = jsonData[0] || [];
            const rows = jsonData.slice(1);

            sheetsData[sheetName] = { headers, rows };
        });

        // Send back the sheet data
        return NextResponse.json({ sheetsData }, { status: 200 });
    } catch (error) {
        console.error('Error parsing XLSX file:', error);
        return NextResponse.json({ error: 'Error parsing file' }, { status: 500 });
    }
}
