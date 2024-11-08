
'use client';

import { useEffect, useState } from 'react';

export default function MainPage() {
    const [files, setFiles] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchFiles = async () => {
            try {
                const res = await fetch('http://localhost:3001/api/files/list'); // Ensure this is the correct URL
                console.log('Fetch response status:', res.status);

                if (!res.ok) {
                    console.error('Failed to fetch file list');
                    setLoading(false);
                    return;
                }

                const data = await res.json();
                console.log('Fetched files:', data.files);
                setFiles(data.files || []); // Set files (or an empty array if undefined)
            } catch (error) {
                console.error('Error fetching files:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchFiles();
    }, []);

    console.log("Rendering component with files:", files);

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
