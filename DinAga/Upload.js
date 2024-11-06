
"use client";
import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { useFiles } from '../../context/FileContext';
import { useRouter } from 'next/navigation';

const UploadPage = () => {
  const { files, addFile, deleteFile } = useFiles();
  const [headers, setHeaders] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const router = useRouter();

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const data = new Uint8Array(event.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const sheetsData = {};

      workbook.SheetNames.forEach((sheetName) => {
        const sheet = workbook.Sheets[sheetName];
        sheetsData[sheetName] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
      });

      addFile({ name: file.name, data: sheetsData });
      setSelectedFile({ name: file.name, data: sheetsData });

      // Assuming the headers are in the first sheet’s first row
      const headers = sheetsData[workbook.SheetNames[0]][0];
      setHeaders(headers);
    };
    reader.readAsArrayBuffer(file);
  };

  const handleDelete = (fileName) => {
    deleteFile(fileName);
    if (selectedFile?.name === fileName) {
      setSelectedFile(null);
      setHeaders([]);
    }
  };

  const handleGoToHomePage = () => {
    router.push('/');
  };

  return (
    <div style={{ padding: '20px' }}>
      <h2>Upload Excel Files</h2>
      <input
        type="file"
        accept=".xlsx, .xls"
        onChange={handleFileUpload}
        style={{ marginBottom: '10px', padding: '8px', cursor: 'pointer' }}
      />
      <h3>Uploaded Files:</h3>
      <ul>
        {files.map((file, idx) => (
          <li key={idx} style={{ marginBottom: '10px' }}>
            {file.name}
            <button onClick={() => handleDelete(file.name)} style={{ marginLeft: '10px', color: 'red' }}>
              Delete
            </button>
          </li>
        ))}
      </ul>
      <button onClick={handleGoToHomePage} style={{ marginTop: '20px', padding: '10px' }}>
        Go to Home Page
      </button>
      {selectedFile && (
        <>
          <h3>Select Header for Navigation Panel</h3>
          <ul>
            {headers.map((header, idx) => (
              <li key={idx} style={{ cursor: 'pointer', margin: '5px 0' }}>
                <button onClick={() => router.push(`/view?file=${selectedFile.name}&header=${header}`)}>
                  Use "{header}" as Header
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
};

export default UploadPage;
