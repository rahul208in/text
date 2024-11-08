
'use client';

import { useEffect, useState } from 'react';

export default function MainPage() {
    const [files, setFiles] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchFiles = async () => {
            try {
                const res = await fetch('http://localhost:3001/api/files/list'); // Adjust the port if necessary
                console.log('Fetch response status:', res.status); // Log response status for debugging

                if (!res.ok) {
                    console.error('Failed to fetch file list');
                    setLoading(false);
                    return;
                }

                const data = await res.json();
                console.log('Fetched files:', data.files); // Log fetched files
                
                // Confirm the files array is being set correctly
                if (data.files && data.files.length > 0) {
                    console.log("Setting files state with data:", data.files);
                    setFiles(data.files);
                } else {
                    console.warn("No files found in response data:", data.files);
                    setFiles([]);
                }
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
                    {files.length > 0 ? (
                        files.map((file, index) => (
                            <li key={index}>
                                <a href={`/uploads/${file}`} target="_blank" rel="noopener noreferrer">
                                    {file}
                                </a>
                            </li>
                        ))
                    ) : (
                        <p>No files found.</p>
                    )}
                </ul>
            )}
        </div>
    );
}
