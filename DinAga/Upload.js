
"use client";

import React, { useState } from 'react';

const UploadPage = () => {
  const [uploadStatus, setUploadStatus] = useState('');
  const [uploadedFilePath, setUploadedFilePath] = useState('');

  const handleFileUpload = async (e) => {
    setUploadStatus(''); // Reset status
    const file = e.target.files[0];

    if (!file) {
      alert("Please select a file to upload.");
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/files/upload', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        console.error('File upload failed:', res.statusText);
        setUploadStatus('File upload failed');
        return;
      }

      const data = await res.json();
      setUploadStatus('File uploaded successfully');
      setUploadedFilePath(data.filePaths[0]); // Assuming only one file is uploaded
      console.log('File uploaded successfully:', data.filePaths);
    } catch (error) {
      console.error('Error uploading file:', error);
      setUploadStatus('Error uploading file');
    }
  };

  return (
    <div style={{ padding: '20px' }}>
      <h2>Upload a File</h2>
      <input 
        type="file" 
        onChange={handleFileUpload} 
        style={{ marginBottom: '10px', cursor: 'pointer' }}
      />
      {uploadStatus && <p>{uploadStatus}</p>}
      {uploadedFilePath && (
        <div>
          <h3>Uploaded File:</h3>
          <a href={`/uploads/${uploadedFilePath}`} target="_blank" rel="noopener noreferrer">
            {uploadedFilePath}
          </a>
        </div>
      )}
    </div>
  );
};

export default UploadPage;
