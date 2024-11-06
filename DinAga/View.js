
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

  if (!selectedFile || headerIndex === null) return <p>Loading data...</p>;

  return (
    <div style={{ display: 'flex', padding: '20px' }}>
      {/* Left Panel */}
      <div style={{ width: '30%', padding: '20px', backgroundColor: '#f9f9f9', borderRadius: '8px', marginRight: '20px' }}>
        <h3>Records for "{header}"</h3>
        {filteredRows.map((row, idx) => (
          <div
            key={idx
