
"use client";
import React, { createContext, useState, useContext } from 'react';

const FileContext = createContext();

export const FileProvider = ({ children }) => {
  const [files, setFiles] = useState([]);

  const addFile = (file) => {
    setFiles((prevFiles) => [...prevFiles, file]);
  };

  const deleteFile = (fileName) => {
    setFiles((prevFiles) => prevFiles.filter((file) => file.name !== fileName));
  };

  return (
    <FileContext.Provider value={{ files, addFile, deleteFile }}>
      {children}
    </FileContext.Provider>
  );
};

export const useFiles = () => useContext(FileContext);
