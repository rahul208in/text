
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
    const [isHelpOpen, setIsHelpOpen] = useState(false); // State to control help modal

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
                {/* Navigation Panel and Main Content code here */}
            </div>

            {isHelpOpen && (
                <div className="modalOverlay" onClick={toggleHelp}>
                    <div className="modalContent" onClick={(e) => e.stopPropagation()}>
                        <h2>How to Use This Site</h2>
                        <ul>
                            <li>To upload an Excel file, click the "Go to Upload Page" button and select your file.</li>
                            <li>Once uploaded, select the file from the list on the main page to view its sheets and data.</li>
                            <li>Click on a sheet to view its headers, and then select a header to see its rows.</li>
                            <li>Choose a row to view its full data in the main display area.</li>
                        </ul>
                        <button onClick={toggleHelp} className="closeButton">Close</button>
                    </div>
                </div>
            )}
        </div>
    );
}
