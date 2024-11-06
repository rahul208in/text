
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
      const res = await fetch(`/uploads/${fileName}`);
      const data = await res.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const sheet = workbook.Sheets[sheetName];
      const sheetData = XLSX.utils.sheet_to_json(sheet, { header: 1 });
      const headers = sheetData[0];
      const index = headers.indexOf(header);
      setHeaderIndex(index);
      setFilteredRows(sheetData.slice(1).filter((row) => row[index]));
    };

    if (fileName && sheetName && header) fetchFileData();
  }, [fileName, sheetName, header]);

  return (
    <div style={{ display: 'flex', padding: '20px' }}>
      {/* Left Panel - Records from Selected Header */}
      <div style={{ width: '30%', padding: '20px', backgroundColor: '#f9f9f9', borderRadius: '8px', marginRight: '20px' }}>
        <h3>Records for "{header}"</h3>
        {filteredRows.map((row
