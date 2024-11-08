
'use client';

import { useEffect, useState } from 'react';

export default function MainPage() {
    const [files, setFiles] = useState([]);
    const [loading, setLoading] = useState(true);

    // Fetch the list of files from the server
    useEffect(() => {
        const fetchFiles = async () => {
            try {
                const res = await fetch('/api/files/list');
                if (!res.ok) {
                    console.error('Failed to fetch file list');
                    setLoading(false);
                    return;
                }
                
                const data = await res.json();
                setFiles(data.files);
            } catch (error) {
                console.error('Error fetching files:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchFiles();
    }, []);

    return (
        <div>
            <h1>Uploaded Files</h1>
            {loading ? (
                <p>Loading files...</p>
            ) : (
                <ul>
                    {files.map((file, index) => (
                        <li key={index}>
                            <a href={`/uploads/${file}`} target="_blank" rel="noopener noreferrer">
                                {file}
                            </a>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
