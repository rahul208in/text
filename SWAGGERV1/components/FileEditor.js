'use client';

import React, { useRef, useEffect } from 'react';

const FileEditor = ({
  selectedFile,
  fileContent,
  editingFile,
  setEditingFile,
  editedContent,
  setEditedContent,
  saveFileContent,
  cursorPosition,
  setCursorPosition
}) => {
  const textareaRef = useRef(null);

  useEffect(() => {
    if (textareaRef.current && editingFile) {
      textareaRef.current.focus();
      try {
        textareaRef.current.setSelectionRange(cursorPosition, cursorPosition);
      } catch (e) {
        console.error("Error setting selection range:", e);
      }
    }
  }, [editingFile, cursorPosition]);

  const handleTextareaChange = (e) => {
    setEditedContent(e.target.value);
    setCursorPosition(e.target.selectionStart);
  };

  const handleTextareaClick = (e) => {
    e.stopPropagation();
    if (e.nativeEvent) e.nativeEvent.stopImmediatePropagation();
    setCursorPosition(e.target.selectionStart);
  };

  const handleKeyDown = (e) => {
    e.stopPropagation();
    if (e.nativeEvent) e.nativeEvent.stopImmediatePropagation();
  };

  return (
    <div className="mt-4">
      <div className="flex justify-between items-center mb-2">
        <h4 className="font-medium">File Content: {selectedFile.name}</h4>
        {!editingFile ? (
          <button 
            className="text-sm text-blue-600 hover:text-blue-800"
            onClick={() => setEditingFile(true)}
          >
            Edit
          </button>
        ) : (
          <div className="space-x-2">
            <button 
              className="text-sm text-green-600 hover:text-green-800"
              onClick={saveFileContent}
            >
              Save
            </button>
            <button 
              className="text-sm text-red-600 hover:text-red-800"
              onClick={() => {
                setEditingFile(false);
                setEditedContent(fileContent);
              }}
            >
              Cancel
            </button>
          </div>
        )}
      </div>
      
      {!editingFile ? (
        <pre className="bg-gray-50 p-2 rounded border text-sm overflow-auto max-h-60">
          {fileContent}
        </pre>
      ) : (
        <div className="relative" onClick={e => e.stopPropagation()}>
          <textarea
            ref={textareaRef}
            className="w-full h-60 font-mono text-sm p-2 border rounded"
            value={editedContent}
            onChange={handleTextareaChange}
            onKeyDown={handleKeyDown}
            onClick={handleTextareaClick}
            onFocus={(e) => {
              e.stopPropagation();
              if (e.nativeEvent) e.nativeEvent.stopImmediatePropagation();
            }}
          />
        </div>
      )}
    </div>
  );
};

export default FileEditor;
