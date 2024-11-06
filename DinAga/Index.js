

import React, { useState } from 'react';
import Upload from '../components/Upload';

const Home = () => {
  const [excelFiles, setExcelFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [selectedSheet, setSelectedSheet] = useState(null);
  const [selectedRow, setSelectedRow] = useState(null);

  const handleFilesUploaded = (files) => {
    setExcelFiles(files);
  };

  const handleFileSelect = (file) => {
    setSelectedFile(file);
    setSelectedSheet(null);
    setSelectedRow(null);
  };

  const handleSheetSelect = (sheetName) => {
    setSelectedSheet(sheetName);
    setSelectedRow(null);
  };

  const handleRowSelect = (row) => {
    setSelectedRow(row);
  };

  return (
    <div style={{ display: 'flex', padding: '20px' }}>
      {/* Left Panel for File and Sheet Selection */}
      <div style={{ width: '30%', padding: '20px', backgroundColor: '#f9f9f9', borderRadius: '8px', marginRight: '20px' }}>
        <h3>Excel Files</h3>
        <Upload onFilesUploaded={handleFilesUploaded} />
        <h4>Uploaded Files:</h4>
        <ul style={{ padding: '0', listStyle: 'none' }}>
          {excelFiles.map((file, idx) => (
            <li
              key={idx}
              onClick={() => handleFileSelect(file)}
              style={{
                cursor: 'pointer',
                padding: '10px',
                margin: '5px 0',
                backgroundColor: selectedFile === file ? '#e0f7fa' : '#fff',
                borderRadius: '5px',
                border: '1px solid #ddd',
              }}
            >
              {file.name}
            </li>
          ))}
        </ul>

        {selectedFile && (
          <>
            <h4>Sheets in {selectedFile.name}:</h4>
            <ul style={{ padding: '0', listStyle: 'none' }}>
              {Object.keys(selectedFile.data).map((sheetName) => (
                <li
                  key={sheetName}
                  onClick={() => handleSheetSelect(sheetName)}
                  style={{
                    cursor: 'pointer',
                    padding: '10px',
                    margin: '5px 0',
                    backgroundColor: selectedSheet === sheetName ? '#e8f5e9' : '#fff',
                    borderRadius: '5px',
                    border: '1px solid #ddd',
                  }}
                >
                  {sheetName}
                </li>
              ))}
            </ul>
          </>
        )}

        {selectedSheet && (
          <>
            <h4>Rows with "hello" in {selectedSheet}:</h4>
            <div style={{ display: 'flex', flexWrap: 'wrap' }}>
              {selectedFile.data[selectedSheet]
                .filter((row) => typeof row[0] === 'string' && row[0].toLowerCase() === 'hello')
                .map((row, idx) => (
                  <div
                    key={idx}
                    onClick={() => handleRowSelect(row)}
                    style={{
                      width: 'calc(50% - 10px)',
                      padding: '15px',
                      margin: '10px',
                      border: '1px solid #ddd',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      backgroundColor: '#f1f8e9',
                    }}
                  >
                    <strong>{row[0]}</strong>
                  </div>
                ))}
            </div>
          </>
        )}
      </div>

      {/* Right Panel for Data Display */}
      <div style={{ width: '70%', padding: '20px', backgroundColor: '#ffffff', borderRadius: '8px' }}>
        {selectedRow && (
          <div style={{ marginTop: '20px' }}>
            <h3>Details for: {selectedRow[0]}</h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', padding: '10px', backgroundColor: '#e3f2fd', borderRadius: '8px' }}>
              {selectedRow.slice(1).map((cell, idx) => (
                <div
                  key={idx}
                  style={{
                    flex: '1 1 30%',
                    padding: '10px',
                    margin: '10px',
                    backgroundColor: '#ffffff',
                    border: '1px solid #ddd',
                    borderRadius: '5px',
                    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
                  }}
                >
                  <strong>Column {idx + 2}:</strong> {cell}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Home;
