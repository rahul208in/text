
"use client";
import React, { useEffect, useState } from 'react';
import { useFiles } from '../../context/FileContext';
import { useRouter, useSearchParams } from 'next/navigation';

const DataViewPage = () => {
  const { files } = useFiles();
  const router = useRouter();
  const searchParams = useSearchParams();
  const fileName = searchParams.get('file');
  const header = searchParams.get('header');

  const [selectedFile, setSelectedFile] = useState(null);
  const [headerIndex, setHeaderIndex] = useState(null);
  const [filteredRows, setFilteredRows] = useState([]);
  const [selectedRow, setSelectedRow] = useState(null);

  useEffect(() => {
    const file = files.find((f) => f.name === fileName);
    setSelectedFile(file);

    if (file && header) {
      const sheetData = file.data[Object.keys(file.data)[0]]; // Use the first sheet
      const headers = sheetData[0];
      const index = headers.indexOf(header);
      setHeaderIndex(index);

      if (index !== -1) {
        const rows = sheetData.slice(1).filter((row) => row[index]);
        setFilteredRows(rows);
      }
    }
  }, [fileName, header, files]);

  const handleRowSelect = (row) => {
    setSelectedRow(row);
  };

  if (!selectedFile || headerIndex === null) return <p>Loading data...</p>;

  return (
    <div style={{ display: 'flex', padding: '20px' }}>
      {/* Left Panel - Records from Selected Header */}
      <div style={{ width: '30%', padding: '20px', backgroundColor: '#f9f9f9', borderRadius: '8px', marginRight: '20px' }}>
        <h3>Records for "{header}"</h3>
        {filteredRows.map((row, idx) => (
          <div
            key={idx}
            onClick={() => handleRowSelect(row)}
            style={{
              padding: '15px',
              margin: '10px 0',
              border: '1px solid #ddd',
              borderRadius: '8px',
              cursor: 'pointer',
              backgroundColor: '#f1f8e9',
            }}
          >
            {row[headerIndex]}
          </div>
        ))}
        {filteredRows.length === 0 && <p>No records found under "{header}"</p>}
      </div>

      {/* Right Panel - Selected Row Details */}
      <div style={{ width: '70%', padding: '20px', backgroundColor: '#ffffff', borderRadius: '8px' }}>
        {selectedRow && (
          <div style={{ marginTop: '20px' }}>
            <h3>Details for: {selectedRow[headerIndex]}</h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', padding: '10px', backgroundColor: '#e3f2fd', borderRadius: '8px' }}>
              {selectedRow.map((cell, idx) => {
                if (idx === headerIndex) return null; // Exclude the selected header column
                return (
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
                    <strong>{selectedFile.data[Object.keys(selectedFile.data)[0]][0][idx] || `Column ${idx + 1}`}:</strong> {cell}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DataViewPage;
