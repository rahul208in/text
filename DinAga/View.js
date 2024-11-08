
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import '../styles/MainPage.css';

export default function MainPage() {
    const router = useRouter();
    const [excelFiles, setExcelFiles] = useState([]);
    const [selectedFile, setSelectedFile] = useState(null);
    const [sheetsData, setSheetsData] = useState({});
    const [selectedSheet, setSelectedSheet] = useState(null);
    const [selectedHeader, setSelectedHeader] = useState(null);
    const [selectedRow, setSelectedRow] = useState(null);
    const [isHelpOpen, setIsHelpOpen] = useState(false); // State to control Help modal

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

    const toggleHelp = () => {
        setIsHelpOpen(!isHelpOpen);
    };

    return (
        <div className="container">
            <div className="topButtons">
                <button onClick={() => router.push('/upload')} className="uploadButton">
                    Go to Upload Page
                </button>
                <button onClick={toggleHelp} className="helpButton">
                    Help
                </button>
            </div>

            <div className="mainContent">
                {/* Left Navigation Panel */}
                <div className="navPanel">
                    {!selectedFile ? (
                        <>
                            <h3>Select an Excel File</h3>
                            <ul className="list">
                                {excelFiles.map((file, index) => (
                                    <li key={index} onClick={() => setSelectedFile(file)} className="listItem">
                                        {file}
                                    </li>
                                ))}
                            </ul>
                        </>
                    ) : (
                        <>
                            <button onClick={() => setSelectedFile(null)} className="backButton">
                                &larr; Back to File Selection
                            </button>
                            <div className="sectionContainer">
                                <h3 className="sectionHeader" onClick={() => setSelectedSheet(selectedSheet ? null : selectedFile)}>
                                    Sheets in {selectedFile} {selectedSheet ? '▲' : '▼'}
                                </h3>
                                {selectedSheet && (
                                    <ul className="list">
                                        {Object.keys(sheetsData).map((sheetName) => (
                                            <li key={sheetName} onClick={() => setSelectedSheet(sheetName)} className="listItem">
                                                {sheetName}
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>

                            {selectedSheet && (
                                <div className="sectionContainer">
                                    <h3 className="sectionHeader" onClick={() => setSelectedHeader(selectedHeader ? null : selectedSheet)}>
                                        Headers in {selectedSheet} {selectedHeader ? '▲' : '▼'}
                                    </h3>
                                    {selectedHeader && (
                                        <ul className="list">
                                            {sheetsData[selectedSheet].headers.map((header, index) => (
                                                <li key={index} onClick={() => setSelectedHeader(header)} className="listItem">
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
                                    <ul className="list">
                                        {sheetsData[selectedSheet].rows.map((row, index) => (
                                            <li key={index} onClick={() => setSelectedRow(row)} className="listItem">
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
                <div className="mainPanel">
                    <h2 className="dataViewerTitle">Data Viewer</h2>
                    {selectedRow ? (
                        <div className="cardContainer">
                            {sheetsData[selectedSheet].headers.map((header, index) => (
                                <div key={index} className="card">
                                    <div className="cardHeader">{header}</div>
                                    <div className="cardContent">{selectedRow[index]}</div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p>Select a row to view data.</p>
                    )}
                </div>
            </div>

            {/* Help Modal */}
            {isHelpOpen && (
                <div className="modalOverlay" onClick={toggleHelp}>
                    <div className="modalContent" onClick={(e) => e.stopPropagation()}>
                        <h2>How to Use This Site</h2>
                        <ul>
                            <li>Click "Go to Upload Page" to upload an Excel file.</li>
                            <li>Select the uploaded file from the list to view its sheets and data.</li>
                            <li>Click a sheet to see its headers, and then select a header to view rows.</li>
                            <li>Select a row to see detailed data displayed on the right.</li>
                        </ul>
                        <button onClick={toggleHelp} className="closeButton">Close</button>
                    </div>
                </div>
            )}
        </div>
    );
}
