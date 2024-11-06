
// app/view/page.js
import React, { useEffect, useState } from 'react';
import { useFiles } from '../../context/FileContext';
import { useRouter, useSearchParams } from 'next/navigation';

const DataViewPage = () => {
  const { files } = useFiles();
  const router = useRouter();
  const searchParams = useSearchParams();
  const fileName = searchParams.get('file');

  const [selectedFile, setSelectedFile] = useState(null);

  useEffect(() => {
    const file = files.find((f) => f.name === fileName);
    setSelectedFile(file);
  }, [fileName, files]);

  if (!selectedFile) return <p>Loading file data...</p>;

  return (
    <div style={{ padding: '20px' }}>
      <h2>Data for {selectedFile.name}</h2>
      {/* Render sheets and rows based on the display logic in your original code */}
      <button onClick={() => router.push('/')} style={{ marginTop: '20px', padding: '10px' }}>
        Back to Home
      </button>
    </div>
  );
};

export default DataViewPage;
