
'use client';

import { useEffect, useState } from 'react';

export default function MainPage() {
    const [excelFiles, setExcelFiles] = useState([]);
    const [selectedFile, setSelectedFile] = useState(null);
    const [sheetsData, setSheetsData] = useState({});
    const [selectedSheet, setSelectedSheet] = useState(null);
    const [selectedHeader, setSelectedHeader] = useState(null);
    const [selectedRow, setSelectedRow] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchFiles = async () => {
            try {
                const res = await fetch('http://localhost:3001/api/files/list');
                if (!res.ok) throw new Error('Failed to fetch file list');
                
                const data = await res.json();
                setExcelFiles(data.files);
            } catch (error) {
                console.error('Error fetching file list:', error);
            }
        };

        fetchFiles();
    }, []);

    const fetchFileData = async (fileName) => {
        setLoading(true);
        try {
            const res = await fetch(`http://localhost:3001/api/files/parse?file=${fileName}`);
            if (!res.ok) throw new Error('Failed to fetch sheets data');
            
            const data = await res.json();
            setSheetsData(data.sheetsData);
            setSelectedSheet(null);
            setSelectedHeader(null);
            setSelectedRow(null);
        } catch (error) {
            console.error('Error fetching sheets data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleFileSelect = (file) => {
        setSelectedFile(file);
        fetchFileData(file);
    };

    const handleSheetSelect = (sheetName) => {
        setSelectedSheet(sheetName);
        setSelectedHeader(null);
        setSelectedRow(null);
    };

    const handleHeaderSelect = (header) => {
        setSelectedHeader(header);
        setSelectedRow(null);
    };

    const handleRowSelect = (row) => {
        setSelectedRow(row);
    };

    return (
        <div style={styles.container}>
            {/* Left Navigation Panel */}
            <div style={styles.navPanel}>
                {!selectedFile ? (
                    <>
                        <h3>Select an Excel File</h3>
                        <ul style={styles.list}>
                            {excelFiles.map((file, index) => (
                                <li key={index} onClick={() => handleFileSelect(file)} style={styles.listItem}>
                                    {file}
                                </li>
                            ))}
                        </ul>
                    </>
                ) : (
                    <>
                        <button onClick={() => setSelectedFile(null)} style={styles.backButton}>
                            &larr; Back to File Selection
                        </button>
                        <h3>Sheets in {selectedFile}</h3>
                        <ul style={styles.list}>
                            {Object.keys(sheetsData).map((sheetName) => (
                                <li key={sheetName} onClick={() => handleSheetSelect(sheetName)} style={styles.listItem}>
                                    {sheetName}
                                </li>
                            ))}
                        </ul>

                        {selectedSheet && (
                            <>
                                <h3>Headers in {selectedSheet}</h3>
                                <ul style={styles.list}>
                                    {sheetsData[selectedSheet].headers.map((header, index) => (
                                        <li key={index} onClick={() => handleHeaderSelect(header)} style={styles.listItem}>
                                            {header}
                                        </li>
                                    ))}
                                </ul>
                            </>
                        )}

                        {selectedHeader && (
                            <>
                                <h3>Rows in {selectedHeader}</h3>
                                <ul style={styles.list}>
                                    {sheetsData[selectedSheet].rows.map((row, index) => (
                                        <li key={index} onClick={() => handleRowSelect(row)} style={styles.listItem}>
                                            {row[sheetsData[selectedSheet].headers.indexOf(selectedHeader)]}
                                        </li>
                                    ))}
                                </ul>
                            </>
                        )}
                    </>
                )}
            </div>

            {/* Right Main Panel */}
            <div style={styles.mainPanel}>
                <h2>Data Viewer</h2>
                {selectedRow ? (
                    <table style={styles.table}>
                        <thead>
                            <tr>
                                {sheetsData[selectedSheet].headers.map((header, index) => (
                                    <th key={index} style={styles.tableHeader}>{header}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                {selectedRow.map((cell, index) => (
                                    <td key={index} style={styles.tableCell}>{cell}</td>
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

const styles = {
    container: {
        display: 'flex',
        fontFamily: 'Arial, sans-serif',
        height: '100vh',
    },
    navPanel: {
        width: '25%',
        borderRight: '1px solid #ddd',
        padding: '20px',
        backgroundColor: '#f8f9fa',
        overflowY: 'auto',
    },
    mainPanel: {
        width: '75%',
        padding: '20px',
        overflowY: 'auto',
    },
    list: {
        listStyleType: 'none',
        padding: 0,
    },
    listItem: {
        padding: '8px 12px',
        marginBottom: '4px',
        cursor: 'pointer',
        borderRadius: '4px',
        backgroundColor: '#e9ecef',
        color: '#333',
        textAlign: 'left',
    },
    listItemHover: {
        backgroundColor: '#ced4da',
    },
    backButton: {
        display: 'inline-block',
        marginBottom: '15px',
        padding: '8px 12px',
        backgroundColor: '#007bff',
        color: '#fff',
        border: 'none',
        borderRadius: '4px',
        cursor: 'pointer',
        fontWeight: 'bold',
    },
    table: {
        width: '100%',
        borderCollapse: 'collapse',
        marginTop: '20px',
    },
    tableHeader: {
        backgroundColor: '#007bff',
        color: '#fff',
        padding: '10px',
        textAlign: 'left',
        borderBottom: '2px solid #ddd',
    },
    tableCell: {
        padding: '10px',
        textAlign: 'left',
        borderBottom: '1px solid #ddd',
    },
};
