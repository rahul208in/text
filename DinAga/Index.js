
import React, { useState } from 'react';
import ExcelReader from '../components/ExcelReader';

const Home = () => {
  const [sheetsData, setSheetsData] = useState({});
  const [selectedSheet, setSelectedSheet] = useState(null);
  const [selectedRow, setSelectedRow] = useState(null);

  const handleFileLoad = (data) => {
    setSheetsData(data);
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
      {/* Left Navigation Panel */}
      <div style={{ width: '20%', borderRight: '1px solid #ddd', padding: '10px' }}>
        <h3>Sheets</h3>
        <ExcelReader onFileLoad={handleFileLoad} />
        <ul>
          {Object.keys(sheetsData).map((sheetName) => (
            <li key={sheetName} onClick={() => handleSheetSelect(sheetName)} style={{ cursor: 'pointer', margin: '10px 0' }}>
              {sheetName}
            </li>
          ))}
        </ul>
      </div>

      {/* Right Panel */}
      <div style={{ width: '80%', padding: '10px' }}>
        {selectedSheet && (
          <div>
            <h3>Data from {selectedSheet}</h3>
            <div style={{ display: 'flex', flexWrap: 'wrap' }}>
              {sheetsData[selectedSheet]
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
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {selectedRow.map((header, idx) => (
                    <th key={idx} style={{ border: '1px solid #ddd', padding: '8px', backgroundColor: '#f5f5f5' }}>
                      Column {idx + 1}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  {selectedRow.map((cell, idx) => (
                    <td key={idx} style={{ border: '1px solid #ddd', padding: '8px' }}>
                      {cell}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default Home;
