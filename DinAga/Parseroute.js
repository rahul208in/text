
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import XLSX from 'xlsx';

export async function GET() {
    try {
        // Define the path to the uploaded file (assuming single file for now)
        const filePath = path.join(process.cwd(), 'public/uploads', 'outlier.xlsx'); // Replace with your actual file name

        // Check if the file exists
        if (!fs.existsSync(filePath)) {
            return NextResponse.json({ error: 'File not found' }, { status: 404 });
        }

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
