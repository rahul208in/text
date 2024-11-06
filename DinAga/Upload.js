
"use client";
import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { useRouter } from 'next/navigation';

const UploadPage = () => {
  const [files, setFiles] = useState([]);
  const [sheets, setSheets] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [selectedSheet, setSelectedSheet] = useState(null);
  const router = useRouter();

  const fetchFiles = async () => {
    const res = await fetch('/api/files/list');
    const data = await res.json();
    setFiles(data);
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    const formData = new FormData();
    formData.append('file', file);

    await fetch('/api/files/upload', {
      method: 'POST',
      body: formData,
    });
    fetchFiles();
  };

  const handleFileSelect = async (fileName) => {
    const res = await fetch(`/uploads/${fileName}`);
    const data = await res.arrayBuffer();
    const workbook = XLSX.read(data, { type: 'array' });
    const sheetNames = workbook.SheetNames;
    setSheets(sheetNames);
    setSelectedFile({ name: fileName, workbook });
  };

  const handleSheetSelect = (sheetName) => {
    const sheet = selectedFile.workbook.Sheets[sheetName];
    const sheetData = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    setHeaders(sheetData[0]); // First row as headers
    setSelectedSheet(sheetName);
  };

  const handleHeaderSelect = (header) => {
    router.push(`/view?file=${selectedFile.name}&sheet=${selectedSheet}&header=${header}`);
  };

  useEffect(() => {
    fetchFiles();
  }, []);

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
            {file}
            <button onClick={() => handleFileSelect(file)} style={{ marginLeft: '10px' }}>
              Select
            </button>
            <button
              onClick={async () => {
                await fetch(`/api/files/delete?fileName=${file}`, { method: 'DELETE' });
                fetchFiles();
              }}
              style={{ marginLeft: '10px', color: 'red' }}
            >
              Delete
            </button>
          </li>
        ))}
      </ul>

      {sheets.length > 0 && (
        <>
          <h3>Select Sheet</h3>
          <ul>
            {sheets.map((sheet, idx) => (
              <li key={idx} style={{ cursor: 'pointer', margin: '5px 0' }}>
                <button onClick={() => handleSheetSelect(sheet)}>{sheet}</button>
              </li>
            ))}
          </ul>
        </>
      )}

      {headers.length > 0 && (
        <>
          <h3>Select Header for Navigation Panel</h3>
          <ul>
            {headers.map((header, idx) => (
              <li key={idx} style={{ cursor: 'pointer', margin: '5px 0' }}>
                <button onClick={() => handleHeaderSelect(header)}>
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
