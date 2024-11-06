
import React, { useEffect, useState } from 'react';
import { useFiles } from '../context/FileContext';
import { useRouter } from 'next/router';

const DataViewPage = () => {
  const { files } = useFiles();
  const router = useRouter();
  const { file: fileName } = router.query;

  const [selectedFile, setSelectedFile] = useState(null);

  useEffect(() => {
    const file = files.find((f) => f.name === fileName);
    setSelectedFile(file);
  }, [fileName, files]);

  if (!selectedFile) return <p>Loading file data...</p>;

  // Here, you can re-use the code from index.js to display the data as required
  // Display the file data as per your original display logic for sheets and rows

  return (
    <div style={{ padding: '20px' }}>
      <h2>Data for {selectedFile.name}</h2>
      {/* Render sheets and rows based on the previous code */}
      <button onClick={() => router.push('/')} style={{ marginTop: '20px', padding: '10px' }}>
        Back to Home
      </button>
    </div>
  );
};

export default DataViewPage;
