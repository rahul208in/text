
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
        setIsSheetOpen(!isSheetOpen);
    };

    const handleHeaderSelect = (header) => {
        setSelectedHeader(header);
        setSelectedRow(null);
        setIsHeaderOpen(!isHeaderOpen);
    };

    const handleRowSelect = (row) => {
        setSelectedRow(row);
    };

    return (
        <div className="container">
            {/* Upload Button */}
            <button onClick={() => router.push('/upload')} className="uploadButton">
                Go to Upload Page
            </button>

            <div className="mainContent">
                {/* Left Navigation Panel */}
                <div className="navPanel">
                    {!selectedFile ? (
                        <>
                            <h3>Select an Excel File</h3>
                            <ul className="list">
                                {excelFiles.map((file, index) => (
                                    <li key={index} onClick={() => handleFileSelect(file)} className="listItem">
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
                                <h3 onClick={() => setIsSheetOpen(!isSheetOpen)} className="sectionHeader">
                                    Sheets in {selectedFile} {isSheetOpen ? '▲' : '▼'}
                                </h3>
                                {isSheetOpen && (
                                    <ul className="list">
                                        {Object.keys(sheetsData).map((sheetName) => (
                                            <li key={sheetName} onClick={() => handleSheetSelect(sheetName)} className="listItem">
                                                {sheetName}
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>

                            {selectedSheet && (
                                <div className="sectionContainer">
                                    <h3 onClick={() => setIsHeaderOpen(!isHeaderOpen)} className="sectionHeader">
                                        Headers in {selectedSheet} {isHeaderOpen ? '▲' : '▼'}
                                    </h3>
                                    {isHeaderOpen && (
                                        <ul className="list">
                                            {sheetsData[selectedSheet].headers.map((header, index) => (
                                                <li key={index} onClick={() => handleHeaderSelect(header)} className="listItem">
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
                                            <li key={index} onClick={() => handleRowSelect(row)} className="listItem">
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
        </div>
    );
}
