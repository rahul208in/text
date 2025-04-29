'use client';

import React from 'react';
import FileEditor from './FileEditor';

const FilesPanel = ({
  uploadedFolder,
  selectedFile,
  viewFileContent,
  fileContent,
  editingFile,
  setEditingFile,
  editedContent,
  setEditedContent,
  saveFileContent,
  cursorPosition,
  setCursorPosition,
  setShowFileExplorer
}) => {
  if (!uploadedFolder || !uploadedFolder.files) {
    return <div>No files uploaded</div>;
  }

  return (
    <div className="file-explorer">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-lg font-semibold">Files</h3>
        <button 
          className="text-sm text-blue-600 hover:text-blue-800"
          onClick={() => setShowFileExplorer(false)}
        >
          Hide
        </button>
      </div>
      <div className="overflow-auto max-h-[30vh]">
        {uploadedFolder.files.map(file => (
          <div 
            key={file.path} 
            className={`py-1 px-2 cursor-pointer rounded ${
              selectedFile && selectedFile.path === file.path 
                ? 'bg-blue-100' 
                : 'hover:bg-gray-100'
            }`}
            onClick={() => viewFileContent(file)}
          >
            {file.name}
          </div>
        ))}
      </div>
      
      {selectedFile && fileContent && (
        <FileEditor
          selectedFile={selectedFile}
          fileContent={fileContent}
          editingFile={editingFile}
          setEditingFile={setEditingFile}
          editedContent={editedContent}
          setEditedContent={setEditedContent}
          saveFileContent={saveFileContent}
          cursorPosition={cursorPosition}
          setCursorPosition={setCursorPosition}
        />
      )}
    </div>
  );
};

export default FilesPanel;
