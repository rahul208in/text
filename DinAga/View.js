
'use client';

import { useEffect, useState } from 'react';

export default function MainPage() {
    const [sheetsData, setSheetsData] = useState({});
    const [selectedSheet, setSelectedSheet] = useState(null);
    const [selectedHeader, setSelectedHeader] = useState(null);
    const [selectedRow, setSelectedRow] = useState(null);
    const [loading, setLoading] = useState(true);

    // Fetch the parsed XLSX data from the API
    useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await fetch('http://localhost:3001/api/files/parse'); // Adjust URL as needed
                if (!res.ok) throw new Error('Failed to fetch sheets data');
                
                const data = await res.json();
                setSheetsData(data.sheetsData);
            } catch (error) {
                console.error('Error fetching sheets data:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    // Handle selecting a sheet
    const handleSheetSelect = (sheetName) => {
        setSelectedSheet(sheetName);
        setSelectedHeader(null); // Reset header and row selection when changing sheets
        setSelectedRow(null);
    };

    // Handle selecting a header
    const handleHeaderSelect = (header) => {
        setSelectedHeader(header);
        setSelectedRow(null); // Reset row selection when changing headers
    };

    // Handle selecting a row
    const handleRowSelect = (row) => {
        setSelectedRow(row);
    };

    if (loading) return <p>Loading data...</p>;

    return (
        <div style={{ display: 'flex' }}>
            {/* Left Navigation Panel */}
            <div style={{ width: '25%', borderRight: '1px solid #ccc', padding: '10px' }}>
                <h3>Sheets</h3>
                <ul>
                    {Object.keys(sheetsData).map((sheetName) => (
                        <li key={sheetName} onClick={() => handleSheetSelect(sheetName)} style={{ cursor: 'pointer' }}>
                            {sheetName}
                        </li>
                    ))}
                </ul>

                {selectedSheet && (
                    <>
                        <h3>Headers in {selectedSheet}</h3>
                        <ul>
                            {sheetsData[selectedSheet].headers.map((header, index) => (
                                <li key={index} onClick={() => handleHeaderSelect(header)} style={{ cursor: 'pointer' }}>
                                    {header}
                                </li>
                            ))}
                        </ul>
                    </>
                )}

                {selectedHeader && (
                    <>
                        <h3>Rows in {selectedHeader}</h3>
                        <ul>
                            {sheetsData[selectedSheet].rows.map((row, index) => (
                                <li key={index} onClick={() => handleRowSelect(row)} style={{ cursor: 'pointer' }}>
                                    {row[sheetsData[selectedSheet].headers.indexOf(selectedHeader)]}
                                </li>
                            ))}
                        </ul>
                    </>
                )}
            </div>

            {/* Right Main Panel */}
            <div style={{ width: '75%', padding: '10px' }}>
                <h2>Data Viewer</h2>
                {selectedRow ? (
                    <table border="1" cellPadding="5">
                        <thead>
                            <tr>
                                {sheetsData[selectedSheet].headers.map((header, index) => (
                                    <th key={index}>{header}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                {selectedRow.map((cell, index) => (
                                    <td key={index}>{cell}</td>
                                ))}
                            </tr>
                        </tbody>
                    </table>
                ) : (
                    <p>Select a row to view data.</p>
                )}
            </div>
        </div>
    );
}
