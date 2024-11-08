
'use client';

import { useState } from 'react';

export default function UploadPage() {
    const [uploadStatus, setUploadStatus] = useState('');

    const handleFileChange = async (event) => {
        const file = event.target.files[0];
        if (file) {
            await uploadFile(file);
        }
    };

    const uploadFile = async (file) => {
        const formData = new FormData();
        formData.append('file', file);

        try {
            const res = await fetch('/api/files/upload', {
                method: 'POST',
                body: formData,
            });

            if (!res.ok) {
                console.error('File upload failed:', res.status, await res.text());
                setUploadStatus('File upload failed');
                return;
            }

            setUploadStatus('File uploaded successfully');
        } catch (error) {
            console.error('Error during file upload:', error);
            setUploadStatus('File upload failed');
        }
    };

    return (
        <div>
            <h1>Upload File</h1>
            <input type="file" onChange={handleFileChange} />
            {uploadStatus && <p>{uploadStatus}</p>}
        </div>
    );
            }
