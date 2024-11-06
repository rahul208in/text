
"use client";
import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import * as XLSX from 'xlsx';

const DataViewPage = () => {
  const searchParams = useSearchParams();
  const fileName = searchParams.get('file');
  const sheetName = searchParams.get('sheet');
  const header = searchParams.get('header');

  const [headerIndex, setHeaderIndex] = useState(null);
  const [filteredRows, setFilteredRows] = useState([]);
  const [selectedRow, setSelectedRow] = useState(null);

  useEffect(() => {
    const fetchFileData = async () => {
      // Fetch the file from the uploads directory
      const res = await fetch(`/uploads/${fileName}`);
      const data = await res.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const sheet = workbook.Sheets[sheetName];
      const sheetData = XLSX.utils.sheet_to_json(sheet, { header: 1 });

      // Find the index of the selected header in the first row
      const headers = sheetData[0];
      const index = headers.indexOf(header);
      setHeaderIndex(index);

      // Filter rows based on the selected header and exclude empty rows
      if (index !== -1) {
        const rows = sheetData.slice(1).filter((row) => row[index]);
        setFilteredRows(rows);
      }
    };

    if (fileName && sheetName && header) fetchFileData();
  }, [fileName, sheetName, header]);

  const handleRowSelect = (row) => {
    setSelectedRow(row);
  };

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
        {selectedRow ? (
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
                    <strong>{sheetData[0][idx] || `Column ${idx + 1}`}:</strong> {cell}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <p>Select a record from the left panel to view details.</p>
        )}
      </div>
    </div>
  );
};

export default DataViewPage;
