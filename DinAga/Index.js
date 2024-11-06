

// app/page.js
import React from 'react';
import { useFiles } from '../context/FileContext';
import { useRouter } from 'next/navigation';

const LandingPage = () => {
  const { files } = useFiles();
  const router = useRouter();

  const handleViewFile = (fileName) => {
    router.push(`/view?file=${fileName}`);
  };

  const handleGoToUploadPage = () => {
    router.push('/upload');
  };

  return (
    <div style={{ padding: '20px' }}>
      <h2>Available Excel Files</h2>
      {files.length > 0 ? (
        <ul>
          {files.map((file, idx) => (
            <li key={idx} style={{ marginBottom: '10px' }}>
              {file.name}
              <button onClick={() => handleViewFile(file.name)} style={{ marginLeft: '10px' }}>
                View Data
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p>No files available. Please upload files.</p>
      )}
      <button onClick={handleGoToUploadPage} style={{ marginTop: '20px', padding: '10px' }}>
        Go to Upload Page
      </button>
    </div>
  );
};

export default LandingPage;
