

import React, { useState } from 'react';
import Upload from './upload';

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
      <div style={{ width: '20%', borderRight: '1px solid #ddd', padding: '10px' }}>
        <h3>Excel Files</h3>
        <Upload onFilesUploaded={handleFilesUploaded} />
        <ul>
          {excelFiles.map((file, idx) => (
            <li key={idx} onClick={() => handleFileSelect(file)} style={{ cursor: 'pointer', margin: '10px 0' }}>
              {file.name}
            </li>
          ))}
        </ul>

        {selectedFile && (
          <>
            <h3>Sheets in {selectedFile.name}</h3>
            <ul>
              {Object.keys(selectedFile.data).map((sheetName) => (
                <li key={sheetName} onClick={() => handleSheetSelect(sheetName)} style={{ cursor: 'pointer', margin: '10px 0' }}>
                  {sheetName}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      {/* Right Panel for Data Display */}
      <div style={{ width: '80%', padding: '10px' }}>
        {selectedSheet && (
          <div>
            <h3>Data from {selectedSheet}</h3>
            <div style={{ display: 'flex', flexWrap: 'wrap' }}>
              {selectedFile.data[selectedSheet]
                .filter((row) => row[0]?.toLowerCase() === 'hello')
                .map((row, idx) => (
                  <div
                    key={idx}
                    onClick={() => handleRowSelect(row)}
                    style={{
                      width: 'calc(50% - 10px)',
                      padding: '10px',
                      margin: '5px',
                      border: '1px solid #ddd',
                      borderRadius: '5px',
                      cursor: 'pointer',
                    }}
                  >
                    {row[0]}
                  </div>
                ))}
            </div>
          </div>
        )}

        {selectedRow && (
          <div style={{ marginTop: '20px' }}>
            <h3>Details for {selectedRow[0]}</h3>
            <div style={{ display: 'flex', flexWrap: 'wrap' }}>
              {selectedRow.map((cell, idx) => (
                <div key={idx} style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '5px', margin: '5px' }}>
                  <strong>Column {idx + 1}:</strong> {cell}
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
