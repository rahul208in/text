
// app/upload/page.js
import React from 'react';
import * as XLSX from 'xlsx';
import { useFiles } from '../../context/FileContext';
import { useRouter } from 'next/navigation';

const UploadPage = () => {
  const { files, addFile, deleteFile } = useFiles();
  const router = useRouter();

  const handleFileUpload = (e) => {
    const filesArray = Array.from(e.target.files);

    filesArray.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const data = new Uint8Array(event.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetsData = {};

        workbook.SheetNames.forEach((sheetName) => {
          const sheet = workbook.Sheets[sheetName];
          sheetsData[sheetName] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        });

        // Add the file to context
        addFile({ name: file.name, data: sheetsData });
      };
      reader.readAsArrayBuffer(file);
    });
  };

  const handleDelete = (fileName) => {
    deleteFile(fileName);
  };

  const handleGoToHomePage = () => {
    router.push('/');
  };

  return (
    <div style={{ padding: '20px' }}>
      <h2>Upload Excel Files</h2>
      <input
        type="file"
        multiple
        accept=".xlsx, .xls"
        onChange={handleFileUpload}
        style={{ marginBottom: '10px', padding: '8px', cursor: 'pointer' }}
      />
      <h3>Uploaded Files:</h3>
      <ul>
        {files.map((file, idx) => (
          <li key={idx} style={{ marginBottom: '10px' }}>
            {file.name}
            <button onClick={() => handleDelete(file.name)} style={{ marginLeft: '10px', color: 'red' }}>
              Delete
            </button>
          </li>
        ))}
      </ul>
      <button onClick={handleGoToHomePage} style={{ marginTop: '20px', padding: '10px' }}>
        Go to Home Page
      </button>
    </div>
  );
};

export default UploadPage;
