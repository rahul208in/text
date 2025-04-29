'use client';

import React, { useState, useEffect } from 'react';
import FilesPanel from './FilesPanel';
import EndpointDetails from './EndpointDetails';
import FileEditor from './FileEditor';
import yaml from 'js-yaml'; // Note: Install this package with npm install js-yaml

const APIExplorer = () => {
  const [uploadedFolder, setUploadedFolder] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [apiSpec, setApiSpec] = useState(null);
  const [selectedEndpoint, setSelectedEndpoint] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [parameterFiles, setParameterFiles] = useState({});
  const [showFileExplorer, setShowFileExplorer] = useState(true);
  const [showApiEndpoints, setShowApiEndpoints] = useState(true);
  const [fileContent, setFileContent] = useState(null);
  const [editingFile, setEditingFile] = useState(false);
  const [editedContent, setEditedContent] = useState('');
  const [cursorPosition, setCursorPosition] = useState(0);
  const [errorMessage, setErrorMessage] = useState(null);
  const [showFileEditor, setShowFileEditor] = useState(false);

  // All the existing functions remain the same
  // ...

  // Handle folder upload
  const handleFolderUpload = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    setErrorMessage(null);
    
    try {
      // Create a timestamp for the folder
      const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
      const directoryPath = `/tmp/api-explorer-${timestamp}`;
      
      // Process the files
      const processedFiles = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        // Read the file content
        const content = await readFileContent(file);
        
        processedFiles.push({
          name: file.name,
          path: `${directoryPath}/${file.name}`,
          relativePath: file.webkitRelativePath || file.name,
          size: file.size,
          file: file,
          content: content
        });
      }
      
      // Set the uploaded folder
      setUploadedFolder({
        directory: directoryPath,
        files: processedFiles
      });
      
      // Find potential API spec files (JSON or YAML files)
      const potentialSpecFiles = processedFiles.filter(file => 
        file.name.endsWith('.json') || 
        file.name.endsWith('.yaml') || 
        file.name.endsWith('.yml')
      );
      
      // Try to parse each potential spec file
      let specFound = false;
      for (const file of potentialSpecFiles) {
        try {
          const parsedSpec = parseApiSpec(file);
          if (parsedSpec && parsedSpec.paths) {
            setApiSpec(parsedSpec);
            specFound = true;
            break;
          }
        } catch (error) {
          console.warn(`File ${file.name} is not a valid API spec:`, error);
        }
      }
      
      if (!specFound) {
        setErrorMessage("No valid OpenAPI/Swagger specification file found. Please ensure your folder contains a valid API spec file.");
      }
      
      // Process parameter files
      await processParameterFiles(processedFiles);
      
    } catch (error) {
      console.error("Error uploading folder:", error);
      setErrorMessage("Error uploading folder: " + error.message);
    } finally {
      setIsUploading(false);
    }
  };

  // Parse API spec file (JSON or YAML)
  const parseApiSpec = (file) => {
    try {
      let parsedSpec;
      
      if (file.name.endsWith('.json')) {
        parsedSpec = JSON.parse(file.content);
      } else if (file.name.endsWith('.yaml') || file.name.endsWith('.yml')) {
        parsedSpec = yaml.load(file.content);
      } else {
        throw new Error("Unsupported file format");
      }
      
      // Basic validation
      if (!parsedSpec.paths) {
        throw new Error("Invalid API specification: 'paths' property missing");
      }
      
      return parsedSpec;
    } catch (error) {
      throw new Error(`Failed to parse API specification: ${error.message}`);
    }
  };

  // Process parameter files
const processParameterFiles = async (files) => {
  const paramFiles = {};
  
  for (const file of files) {
    try {
      if (file.name.endsWith('.yaml') || file.name.endsWith('.yml')) {
        // Parse YAML files
        if (file.name.includes('_path.yaml')) {
          try {
            const yamlContent = yaml.load(file.content);
            paramFiles[file.name] = yamlContent;
          } catch (e) {
            // Fallback to regex parsing if YAML parsing fails
            try {
              // Try array format first
              const arrayMatches = [...file.content.matchAll(/- name:\s*"([^"]+)"\s*\n\s*value:\s*"([^"]*)"/g)];
              if (arrayMatches.length > 0) {
                const params = arrayMatches.map(match => ({
                  name: match[1],
                  value: match[2]
                }));
                
                paramFiles[file.name] = {
                  parameters: {
                    parameter: params
                  }
                };
              } else {
                // Try single parameter format
                const match = file.content.match(/name:\s*"([^"]+)"\s*\n\s*value:\s*"([^"]*)"/);
                if (match) {
                  paramFiles[file.name] = {
                    parameters: {
                      parameter: {
                        name: match[1],
                        value: match[2]
                      }
                    }
                  };
                }
              }
            } catch (regexError) {
              console.warn(`Failed to parse path YAML file ${file.name} with regex:`, regexError);
            }
          }
        } else if (file.name.includes('_header.yaml')) {
          try {
            const yamlContent = yaml.load(file.content);
            paramFiles[file.name] = yamlContent;
          } catch (e) {
            // Fallback to regex parsing if YAML parsing fails
            const headerMatches = [...file.content.matchAll(/- name:\s*"([^"]+)"\s*\n\s*value:\s*"([^"]*)"/g)];
            if (headerMatches.length > 0) {
              const headers = headerMatches.map(match => ({
                name: match[1],
                value: match[2]
              }));
              
              paramFiles[file.name] = {
                headers: {
                  header: headers
                }
              };
            }
          }
        }
      } else if (file.name.endsWith('.json')) {
        try {
          // Parse JSON files (like schema files)
          paramFiles[file.name] = JSON.parse(file.content);
        } catch (e) {
          console.warn(`Failed to parse JSON file ${file.name}:`, e);
        }
      }
    } catch (error) {
      console.error(`Error processing file ${file.name}:`, error);
    }
  }
  
  setParameterFiles(paramFiles);
};

  // Helper function to read file content
  const readFileContent = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = (e) => reject(new Error("Error reading file"));
      reader.readAsText(file);
    });
  };

 // Helper function to find parameter files for an endpoint
const findParameterFiles = (operationId, path) => {
  // Extract the last segment of the path for the filename
  const pathSegments = path.replace(/^\//, '').split('/');
  const lastPathSegment = pathSegments[pathSegments.length - 1];
  
  const result = {
    path: null,
    headers: null,
    body: null
  };
  
  // Check for path/query parameter file using the last path segment
  const pathFileName = `${operationId}_${lastPathSegment}_path.yaml`;
  if (parameterFiles[pathFileName]) {
    result.path = parameterFiles[pathFileName];
  }
  
  // Check for header parameter file using the last path segment
  const headersFileName = `${operationId}_${lastPathSegment}_header.yaml`;
  if (parameterFiles[headersFileName]) {
    result.headers = parameterFiles[headersFileName];
  }
  
  return result;
};

  // Helper function to find schema reference files
  const findSchemaFile = (schemaRef) => {
    if (!schemaRef) return null;
    
    // Extract schema name from reference like "#/components/schemas/ReportRequest"
    const schemaName = schemaRef.split('/').pop();
    const fileName = `${schemaName}.json`;
    
    if (parameterFiles[fileName]) {
      return parameterFiles[fileName];
    }
    
    return null;
  };

  // Helper function to view file content
  const viewFileContent = (file) => {
    setSelectedFile(file);
    setFileContent(file.content);
    setEditingFile(false);
    setEditedContent(file.content);
    
    // Try to detect if this is an API spec file
    try {
      const parsedSpec = parseApiSpec(file);
      if (parsedSpec && parsedSpec.paths) {
        setApiSpec(parsedSpec);
      }
    } catch (error) {
      // Not an API spec file, or invalid - that's fine
    }
  };

  // Helper function to save edited file content
  const saveFileContent = () => {
    if (!selectedFile) return;
    
    // Update the file content in the uploadedFolder
    const updatedFiles = uploadedFolder.files.map(file => {
      if (file.path === selectedFile.path) {
        return { ...file, content: editedContent };
      }
      return file;
    });
    
    setUploadedFolder({ ...uploadedFolder, files: updatedFiles });
    
    // Update the file content in the parameterFiles if it's a parameter file
    try {
      const fileName = selectedFile.name;
      
      if (fileName.endsWith('.yaml') || fileName.endsWith('.yml')) {
        try {
          const parsedYaml = yaml.load(editedContent);
          setParameterFiles(prev => ({
            ...prev,
            [fileName]: parsedYaml
          }));
        } catch (e) {
          console.warn(`Failed to parse edited YAML for ${fileName}:`, e);
          
          // Fallback to regex parsing
          if (fileName.includes('_path.yaml')) {
            const match = editedContent.match(/name:\s*"([^"]+)"\s*\n\s*value:\s*"([^"]*)"/);
            if (match) {
              setParameterFiles(prev => ({
                ...prev,
                [fileName]: {
                  parameters: {
                    parameter: {
                      name: match[1],
                      value: match[2]
                    }
                  }
                }
              }));
            }
          } else if (fileName.includes('_header.yaml')) {
            const headerMatches = [...editedContent.matchAll(/- name:\s*"([^"]+)"\s*\n\s*value:\s*"([^"]*)"/g)];
            if (headerMatches.length > 0) {
              const headers = headerMatches.map(match => ({
                name: match[1],
                value: match[2]
              }));
              
              setParameterFiles(prev => ({
                ...prev,
                [fileName]: {
                  headers: {
                    header: headers
                  }
                }
              }));
            }
          }
        }
      } else if (fileName.endsWith('.json')) {
        try {
          const parsedJson = JSON.parse(editedContent);
          setParameterFiles(prev => ({
            ...prev,
            [fileName]: parsedJson
          }));
          
          // Check if this might be an API spec file
          if (parsedJson.paths) {
            setApiSpec(parsedJson);
          }
        } catch (e) {
          console.warn(`Failed to parse edited JSON for ${fileName}:`, e);
        }
      }
    } catch (error) {
      console.error("Error parsing file content:", error);
    }
    
    setFileContent(editedContent);
    setEditingFile(false);
    setShowFileEditor(false);
  };

  // Component for folder upload
  const FolderUpload = () => (
    <div className="flex flex-col items-center justify-center p-10 border-2 border-dashed border-gray-300 rounded-lg">
      <h2 className="text-xl mb-4">Upload API Folder</h2>
      <p className="mb-6 text-gray-600 text-center">
        Select a folder containing OpenAPI/Swagger files and supporting documents
      </p>
      
      <input
        type="file"
        id="folder-upload"
        webkitdirectory="true"
        directory="true"
        multiple
        onChange={handleFolderUpload}
        className="hidden"
      />
      <label
        htmlFor="folder-upload"
        className="bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded cursor-pointer"
      >
        {isUploading ? "Uploading..." : "Select Folder"}
      </label>
      
      {errorMessage && (
        <p className="mt-4 text-red-500">{errorMessage}</p>
      )}
    </div>
  );

  // Component for API panel
  const ApiPanel = () => {
    if (!apiSpec || !apiSpec.paths) {
      return <div>No API specification found</div>;
    }

    const endpoints = Object.entries(apiSpec.paths).flatMap(([path, methods]) => {
      return Object.entries(methods).map(([method, details]) => {
        return {
          path,
          method: method.toUpperCase(),
          details,
          id: `${method}-${path}`
        };
      });
    });

    return (
      <div className="api-panel">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-lg font-semibold">API Endpoints</h3>
          <button 
            className="text-sm text-blue-600 hover:text-blue-800"
            onClick={() => setShowApiEndpoints(false)}
          >
            Hide
          </button>
        </div>
        <div className="space-y-1 max-h-[calc(100vh-350px)] overflow-auto">
          {endpoints.map(endpoint => (
            <div
              key={endpoint.id}
              className={`p-2 rounded cursor-pointer flex items-center ${
                selectedEndpoint && selectedEndpoint.id === endpoint.id
                  ? 'bg-blue-100'
                  : 'hover:bg-gray-100'
              }`}
              onClick={() => setSelectedEndpoint(endpoint)}
            >
              <span className={`
                inline-block px-2 py-1 text-xs font-bold rounded mr-2
                ${endpoint.method === 'GET' ? 'bg-green-100 text-green-800' : ''}
                ${endpoint.method === 'POST' ? 'bg-blue-100 text-blue-800' : ''}
                ${endpoint.method === 'PUT' ? 'bg-yellow-100 text-yellow-800' : ''}
                ${endpoint.method === 'DELETE' ? 'bg-red-100 text-red-800' : ''}
              `}>
                {endpoint.method}
              </span>
              <span className="truncate">{endpoint.path}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Floating File Editor component
  const FloatingFileEditor = () => {
    if (!showFileEditor || !selectedFile) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] flex flex-col">
          <div className="flex justify-between items-center p-4 border-b">
            <h3 className="font-bold">Editing: {selectedFile.name}</h3>
            <button 
              className="text-gray-500 hover:text-gray-700"
              onClick={() => {
                setShowFileEditor(false);
                setEditingFile(false);
              }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="p-4 flex-grow overflow-auto">
            <textarea
              className="w-full h-full min-h-[400px] font-mono text-sm p-2 border rounded"
              value={editedContent}
              onChange={(e) => {
                setEditedContent(e.target.value);
                setCursorPosition(e.target.selectionStart);
              }}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.nativeEvent) e.nativeEvent.stopImmediatePropagation();
              }}
              onClick={(e) => {
                e.stopPropagation();
                if (e.nativeEvent) e.nativeEvent.stopImmediatePropagation();
                setCursorPosition(e.target.selectionStart);
              }}
            />
          </div>
          <div className="p-4 border-t flex justify-end space-x-2">
            <button 
              className="bg-gray-300 hover:bg-gray-400 text-gray-800 px-4 py-2 rounded"
              onClick={() => {
                setShowFileEditor(false);
                setEditingFile(false);
                setEditedContent(fileContent);
              }}
            >
              Cancel
            </button>
            <button 
              className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
              onClick={() => {
                saveFileContent();
              }}
            >
              Save
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <h1 className="text-2xl font-bold mb-6">API Explorer</h1>
      
      {!uploadedFolder ? (
        <FolderUpload />
      ) : (
        <div className="flex flex-col gap-6 h-[calc(100vh-150px)]">
          {/* Control buttons for hidden panels */}
          <div className="flex space-x-4">
            {!showFileExplorer && (
              <button 
                className="text-blue-600 hover:text-blue-800 flex items-center"
                onClick={() => setShowFileExplorer(true)}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                </svg>
                Show Files
              </button>
            )}
            
            {!showApiEndpoints && apiSpec && (
              <button 
                className="text-blue-600 hover:text-blue-800 flex items-center"
                onClick={() => setShowApiEndpoints(true)}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M12.316 3.051a1 1 0 01.633 1.265l-4 12a1 1 0 11-1.898-.632l4-12a1 1 0 011.265-.633zM5.707 6.293a1 1 0 010 1.414L3.414 10l2.293 2.293a1 1 0 11-1.414 1.414l-3-3a1 1 0 010-1.414l3-3a1 1 0 011.414 0zm8.586 0a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 11-1.414-1.414L16.586 10l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
                Show API Endpoints
              </button>
            )}
          </div>
          
          <div className="flex gap-6 h-full">
            {/* File Explorer Panel */}
            {showFileExplorer && (
              <div className={`bg-gray-50 p-4 rounded-lg overflow-auto ${!showApiEndpoints || !selectedEndpoint ? 'w-1/3' : 'w-1/4'}`}>
                <FilesPanel 
                  uploadedFolder={uploadedFolder}
                  selectedFile={selectedFile}
                  viewFileContent={viewFileContent}
                  fileContent={fileContent}
                  editingFile={editingFile}
                  setEditingFile={(editing) => {
                    setEditingFile(editing);
                    setShowFileEditor(editing);
                  }}
                  editedContent={editedContent}
                  setEditedContent={setEditedContent}
                  saveFileContent={saveFileContent}
                  cursorPosition={cursorPosition}
                  setCursorPosition={setCursorPosition}
                  setShowFileExplorer={setShowFileExplorer}
                />
              </div>
            )}
            
            {/* API and Endpoint Details */}
            <div className={`flex-1 flex ${selectedEndpoint ? 'gap-6' : ''}`}>
              {/* API Endpoints Panel */}
              {apiSpec && showApiEndpoints && (
                <div className={`bg-gray-50 p-4 rounded-lg ${selectedEndpoint ? 'w-1/3' : 'w-full'}`}>
                  <ApiPanel />
                </div>
              )}
              
              {/* Endpoint Details Panel */}
              {selectedEndpoint && (
                <div className={`bg-white p-4 rounded-lg overflow-auto ${showApiEndpoints ? 'w-2/3' : 'w-full'}`}>
                  <EndpointDetails 
                    selectedEndpoint={selectedEndpoint}
                    apiSpec={apiSpec}
                    findParameterFiles={findParameterFiles}
                    findSchemaFile={findSchemaFile}
                    uploadedFolder={uploadedFolder}
                    viewFileContent={(file) => {
                      viewFileContent(file);
                      // Optionally hide other panels when viewing a file
                      // setShowApiEndpoints(false);
                    }}
                    parameterFiles={parameterFiles}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Floating File Editor Modal */}
          <FloatingFileEditor />
        </div>
      )}
    </div>
  );
};

export default APIExplorer;
