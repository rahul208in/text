
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
    const [isSheetOpen, setIsSheetOpen] = useState(true);
    const [isHeaderOpen, setIsHeaderOpen] = useState(true);

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
        setIsSheetOpen(!isSheetOpen); // Toggle sheet section open/close
    };

    const handleHeaderSelect = (header) => {
        setSelectedHeader(header);
        setSelectedRow(null);
        setIsHeaderOpen(!isHeaderOpen); // Toggle header section open/close
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
                        <div style={styles.sectionContainer}>
                            <h3 onClick={() => setIsSheetOpen(!isSheetOpen)} style={styles.sectionHeader}>
                                Sheets in {selectedFile} {isSheetOpen ? '▲' : '▼'}
                            </h3>
                            {isSheetOpen && (
                                <ul style={styles.list}>
                                    {Object.keys(sheetsData).map((sheetName) => (
                                        <li key={sheetName} onClick={() => handleSheetSelect(sheetName)} style={styles.listItem}>
                                            {sheetName}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>

                        {selectedSheet && (
                            <div style={styles.sectionContainer}>
                                <h3 onClick={() => setIsHeaderOpen(!isHeaderOpen)} style={styles.sectionHeader}>
                                    Headers in {selectedSheet} {isHeaderOpen ? '▲' : '▼'}
                                </h3>
                                {isHeaderOpen && (
                                    <ul style={styles.list}>
                                        {sheetsData[selectedSheet].headers.map((header, index) => (
                                            <li key={index} onClick={() => handleHeaderSelect(header)} style={styles.listItem}>
                                                {header}
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
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
                <h2 style={styles.dataViewerTitle}>Data Viewer</h2>
                {selectedRow ? (
                    <div style={styles.cardContainer}>
                        {sheetsData[selectedSheet].headers.map((header, index) => (
                            <div key={index} style={styles.card}>
                                <div style={styles.cardHeader}>{header}</div>
                                <div style={styles.cardContent}>{selectedRow[index]}</div>
                            </div>
                        ))}
                    </div>
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
        backgroundColor: '#f5f8fa',
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
        transition: 'background-color 0.2s ease',
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
    sectionContainer: {
        marginBottom: '15px',
        padding: '10px',
        borderRadius: '8px',
        backgroundColor: '#f1f3f5',
        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
    },
    sectionHeader: {
        cursor: 'pointer',
        fontWeight: 'bold',
        marginTop: '10px',
        marginBottom: '10px',
        color: '#495057',
        padding: '8px 12px',
        backgroundColor: '#e0e7ff',
        borderRadius: '6px',
    },
    cardContainer: {
        display: 'flex',
        flexWrap: 'wrap',
        gap: '10px',
    },
    card: {
        width: '150px',
        padding: '10px',
        borderRadius: '8px',
        boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)',
        backgroundColor: '#fff',
        textAlign: 'center',
        transition: 'box-shadow 0.2s ease',
    },
    cardHeader: {
        fontWeight: 'bold',
        fontSize: '16px',
        color: '#4a4a4a',
        padding: '6px 0',
        borderBottom: '1px solid #dee2e6',
        backgroundColor: '#f8f9fa',
        borderRadius: '6px 6px 0 0',
    },
    cardContent: {
        fontSize: '14px',
        color: '#333',
        padding: '10px',
    },
    dataViewerTitle: {
        color: '#495057',
        marginBottom: '20px',
        fontSize: '22px',
        fontWeight: '600',
    },
};
