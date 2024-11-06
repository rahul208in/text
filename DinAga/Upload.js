
import React, { useState } from 'react';
import * as XLSX from 'xlsx';

const Upload = ({ onFilesUploaded }) => {
  const [excelFiles, setExcelFiles] = useState([]);

  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files);
    const newFiles = [];

    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const data = new Uint8Array(event.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetsData = {};

        workbook.SheetNames.forEach((sheetName) => {
          const sheet = workbook.Sheets[sheetName];
          sheetsData[sheetName] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        });

        newFiles.push({ name: file.name, data: sheetsData });

        if (newFiles.length === files.length) {
          setExcelFiles((prevFiles) => [...prevFiles, ...newFiles]);
          onFilesUploaded([...excelFiles, ...newFiles]);
        }
      };
      reader.readAsArrayBuffer(file);
    });
  };

  return (
    <div style={{ padding: '20px' }}>
      <h2>Upload Excel Files</h2>
      <input type="file" multiple accept=".xlsx, .xls" onChange={handleFileUpload} />
      <ul>
        {excelFiles.map((file, idx) => (
          <li key={idx}>{file.name}</li>
        ))}
      </ul>
    </div>
  );
};

export default Upload;
