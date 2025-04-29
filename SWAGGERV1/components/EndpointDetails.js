'use client';

import React, { useState, useEffect, useRef } from 'react';

const EndpointDetails = ({ 
  selectedEndpoint, 
  apiSpec, 
  findParameterFiles, 
  findSchemaFile, 
  uploadedFolder, 
  viewFileContent,
  parameterFiles
}) => {
  const [requestBody, setRequestBody] = useState('{}');
  const [response, setResponse] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [parameters, setParameters] = useState({});
  const [headerParameters, setHeaderParameters] = useState({});
  const [missingParameters, setMissingParameters] = useState([]);
  const [requestBodyCursorPosition, setRequestBodyCursorPosition] = useState(0);
  const [allRequiredFieldsPresent, setAllRequiredFieldsPresent] = useState(false);
  const requestBodyRef = useRef(null);

  useEffect(() => {
    if (!selectedEndpoint) return;
    
    const { path, method, details } = selectedEndpoint;
    const operationId = details.operationId || '';
    
    // Find parameter files for this endpoint
    const paramFiles = findParameterFiles(operationId, path);
    
    // Initialize query parameters from path parameter file
    const initialParams = {};
    const missing = [];
    
    // Check for query parameters in the endpoint definition
    if (details.parameters) {
      details.parameters.filter(p => p.in === 'query').forEach(param => {
        // Check if we have a value from parameter file
        let paramValue = '';
        
        if (paramFiles.path && paramFiles.path.parameters && paramFiles.path.parameters.parameter) {
          const fileParams = paramFiles.path.parameters.parameter;
          
          // Handle both array and single object formats
          if (Array.isArray(fileParams)) {
            const matchingParam = fileParams.find(p => p.name === param.name);
            if (matchingParam) {
              paramValue = matchingParam.value || '';
            }
          } else if (fileParams.name === param.name) {
            paramValue = fileParams.value || '';
          }
        }
        
        initialParams[param.name] = paramValue;
        
        // Track missing required parameters
        if (param.required && !paramValue) {
          missing.push({
            name: param.name,
            type: 'query',
            file: `${operationId}_${getLastPathSegment(path)}_path.yaml`
          });
        }
      });
    }
    
    // Initialize header parameters from headers file
    const initialHeaders = {};
    
    // Check for header parameters in the endpoint definition
    if (details.parameters) {
      details.parameters.filter(p => p.in === 'header').forEach(param => {
        // Check if we have a value from headers file
        let headerValue = '';
        
        if (paramFiles.headers && paramFiles.headers.headers && paramFiles.headers.headers.header) {
          const headers = paramFiles.headers.headers.header;
          
          // Handle both array and single object formats
          if (Array.isArray(headers)) {
            const matchingHeader = headers.find(h => h.name === param.name);
            if (matchingHeader) {
              headerValue = matchingHeader.value || '';
            }
          } else if (headers.name === param.name) {
            headerValue = headers.value || '';
          }
        }
        
        initialHeaders[param.name] = headerValue;
        
        // Track missing required parameters
        if (param.required && !headerValue) {
          missing.push({
            name: param.name,
            type: 'header',
            file: `${operationId}_${getLastPathSegment(path)}_header.yaml`
          });
        }
      });
    }
    
    // Set parameters
    setParameters(initialParams);
    setHeaderParameters(initialHeaders);
    setMissingParameters(missing);
    
    // Set request body from schema reference file
    if (details.requestBody && 
        details.requestBody.content && 
        details.requestBody.content['application/json'] && 
        details.requestBody.content['application/json'].schema) {
      
      const schema = details.requestBody.content['application/json'].schema;
      
      if (schema.$ref) {
        // Direct schema reference
        const schemaFile = findSchemaFile(schema.$ref);
        if (schemaFile) {
          setRequestBody(JSON.stringify(schemaFile, null, 2));
        } else {
          setRequestBody(JSON.stringify({}, null, 2));
          
          // If request body is required and we don't have a schema file, add to missing
          if (details.requestBody.required) {
            const schemaName = schema.$ref.split('/').pop();
            missing.push({
              name: schemaName,
              type: 'body',
              file: `${schemaName}.json`
            });
          }
        }
      } else if (schema.items && schema.items.$ref) {
        // Array of schema references
        const schemaFile = findSchemaFile(schema.items.$ref);
        if (schemaFile) {
          setRequestBody(JSON.stringify(schemaFile, null, 2));
        } else {
          setRequestBody(JSON.stringify([], null, 2));
          
          // If request body is required and we don't have a schema file, add to missing
          if (details.requestBody.required) {
            const schemaName = schema.items.$ref.split('/').pop();
            missing.push({
              name: schemaName,
              type: 'body',
              file: `${schemaName}.json`
            });
          }
        }
      } else {
        setRequestBody(JSON.stringify({}, null, 2));
      }
    } else {
      setRequestBody('{}');
    }
    
    // Update the missing parameters
    setMissingParameters(missing);
    
    // Update the flag indicating if all required fields are present
    setAllRequiredFieldsPresent(missing.length === 0);
    
    setResponse(null);
  }, [selectedEndpoint, findParameterFiles, findSchemaFile]);

  // Helper function to get the last segment of a path
  const getLastPathSegment = (path) => {
    const pathSegments = path.replace(/^\//, '').split('/');
    return pathSegments[pathSegments.length - 1];
  };

  const handleParameterChange = (name, value) => {
    setParameters(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Update missing parameters
    updateMissingParameters();
  };
  
  const handleHeaderChange = (name, value) => {
    setHeaderParameters(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Update missing parameters
    updateMissingParameters();
  };

  const updateMissingParameters = () => {
    if (!selectedEndpoint) return;
    
    const { path, details } = selectedEndpoint;
    const operationId = details.operationId || '';
    const missing = [];
    
    // Check query parameters
    if (details.parameters) {
      details.parameters.filter(p => p.in === 'query').forEach(param => {
        if (param.required && !parameters[param.name]) {
          missing.push({
            name: param.name,
            type: 'query',
            file: `${operationId}_${getLastPathSegment(path)}_path.yaml`
          });
        }
      });
      
      // Check header parameters
      details.parameters.filter(p => p.in === 'header').forEach(param => {
        if (param.required && !headerParameters[param.name]) {
          missing.push({
            name: param.name,
            type: 'header',
            file: `${operationId}_${getLastPathSegment(path)}_header.yaml`
          });
        }
      });
    }
    
    // Check request body
    if (details.requestBody && details.requestBody.required) {
      const schema = details.requestBody.content && 
                     details.requestBody.content['application/json'] && 
                     details.requestBody.content['application/json'].schema;
                     
      if (schema) {
        let schemaName = '';
        
        if (schema.$ref) {
          schemaName = schema.$ref.split('/').pop();
          const schemaFile = findSchemaFile(schema.$ref);
          if (!schemaFile) {
            missing.push({
              name: schemaName,
              type: 'body',
              file: `${schemaName}.json`
            });
          }
        } else if (schema.items && schema.items.$ref) {
          schemaName = schema.items.$ref.split('/').pop();
          const schemaFile = findSchemaFile(schema.items.$ref);
          if (!schemaFile) {
            missing.push({
              name: schemaName,
              type: 'body',
              file: `${schemaName}.json`
            });
          }
        }
      }
    }
    
    setMissingParameters(missing);
    setAllRequiredFieldsPresent(missing.length === 0);
  };

  const handleTest = async () => {
    setIsLoading(true);
    setResponse(null);
    
    try {
      const { path, method } = selectedEndpoint;
      
      // Build the URL with query parameters
      const serverUrl = apiSpec.servers && apiSpec.servers.length > 0 ? apiSpec.servers[0].url : '';
      let url = new URL(serverUrl + path);
      
      // Add query parameters
      Object.entries(parameters).forEach(([key, value]) => {
        if (value) url.searchParams.append(key, value);
      });
      
      // Prepare headers
      const headers = {};
      Object.entries(headerParameters).forEach(([key, value]) => {
        if (value) headers[key] = value;
      });
      
      // Add content-type for POST/PUT requests
      if (method === 'POST' || method === 'PUT') {
        headers['Content-Type'] = 'application/json';
      }
      
      // Prepare request body for POST/PUT
      let body = null;
      if ((method === 'POST' || method === 'PUT') && requestBody) {
        try {
          // Try to parse the request body as JSON
          body = JSON.parse(requestBody);
        } catch (e) {
          throw new Error(`Invalid JSON in request body: ${e.message}`);
        }
      }
      
      // Make the actual API request
      const requestOptions = {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined
      };
      
      console.log(`Making ${method} request to ${url.toString()}`);
      console.log('Headers:', headers);
      if (body) console.log('Body:', body);
      
      const response = await fetch(url.toString(), requestOptions);
      const contentType = response.headers.get('content-type');
      
      let responseBody;
      if (contentType && contentType.includes('application/json')) {
        responseBody = await response.json();
      } else {
        responseBody = await response.text();
      }
      
      setResponse({
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries([...response.headers.entries()]),
        body: responseBody
      });
    } catch (error) {
      console.error('API request failed:', error);
      setResponse({
        status: 500,
        statusText: 'Error',
        body: { error: error.message }
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!selectedEndpoint) return null;

  const { path, method, details } = selectedEndpoint;
  const serverUrl = apiSpec.servers && apiSpec.servers.length > 0 ? apiSpec.servers[0].url : '';
  const fullUrl = serverUrl + path;
  
  // Find parameter files for this endpoint
  const operationId = details.operationId || '';
  const lastPathSegment = getLastPathSegment(path);
  const paramFiles = findParameterFiles(operationId, path);
  
  // Check if we have schema files for request body
  let schemaFile = null;
  let schemaFileName = '';
  if (details.requestBody && 
      details.requestBody.content && 
      details.requestBody.content['application/json'] && 
      details.requestBody.content['application/json'].schema) {
    
    const schema = details.requestBody.content['application/json'].schema;
    
    if (schema.$ref) {
      schemaFileName = schema.$ref.split('/').pop();
      schemaFile = findSchemaFile(schema.$ref);
    } else if (schema.items && schema.items.$ref) {
      schemaFileName = schema.items.$ref.split('/').pop();
      schemaFile = findSchemaFile(schema.items.$ref);
    }
  }

  // Helper function to create file template
  const createPathFileTemplate = (paramName, paramValue) => {
    return `---
parameters:
  parameter:
    name: "${paramName}"
    value: "${paramValue || ''}"`;
  };

  // Helper function to create multi-parameter file template
  const createMultiParamFileTemplate = (params) => {
    let template = `---
parameters:
  parameter:`;
    
    params.forEach(param => {
      template += `
    - name: "${param.name}"
      value: "${param.example || ''}"`;
    });
    
    return template;
  };

  // Helper function to create header file template
  const createHeaderFileTemplate = (headerParams) => {
    let template = `---
headers:
  header:`;
    
    headerParams.forEach(param => {
      template += `
  - name: "${param.name}"
    value: "${param.example || ''}"`;
    });
    
    return template;
  };
  
  return (
    <div className="endpoint-details">
      <div className="mb-4">
        <h3 className="text-xl font-bold mb-2">
          <span className={`
            inline-block px-2 py-1 text-xs font-bold rounded mr-2
            ${method === 'GET' ? 'bg-green-100 text-green-800' : ''}
            ${method === 'POST' ? 'bg-blue-100 text-blue-800' : ''}
            ${method === 'PUT' ? 'bg-yellow-100 text-yellow-800' : ''}
            ${method === 'DELETE' ? 'bg-red-100 text-red-800' : ''}
          `}>
            {method}
          </span>
          {path}
        </h3>
        <p className="text-gray-600">{details.summary || 'No description'}</p>
        <p className="text-sm text-blue-600 mt-1">
          <span className="font-medium">Full URL:</span> {fullUrl}
        </p>
        {details.operationId && (
          <p className="text-sm text-gray-500 mt-1">
            <span className="font-medium">Operation ID:</span> {details.operationId}
          </p>
        )}
      </div>

      {/* Missing Parameters Warning */}
      {missingParameters.length > 0 && (
        <div className="mb-6 p-3 bg-yellow-50 border border-yellow-200 rounded">
          <h4 className="text-yellow-800 font-medium mb-2">Missing Required Parameters</h4>
          <p className="text-sm text-yellow-700 mb-2">
            The following required parameters are missing values. You can edit the corresponding files to add them:
          </p>
          <ul className="list-disc pl-5 text-sm text-yellow-700">
            {missingParameters.map((param, index) => (
              <li key={index}>
                <span className="font-medium">{param.name}</span> ({param.type}) - Edit file: {param.file}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Query Parameters */}
      {details.parameters && details.parameters.filter(p => p.in === 'query').length > 0 && (
        <div className="mb-6">
          <h4 className="text-lg font-semibold mb-2">Query Parameters</h4>
          <div className="space-y-3">
            {details.parameters.filter(p => p.in === 'query').map(param => {
              // Check if we have a value from parameter file
              const pathFileName = `${operationId}_${lastPathSegment}_path.yaml`;
              const hasFileValue = paramFiles.path && 
                paramFiles.path.parameters && 
                paramFiles.path.parameters.parameter;
              
              let fileValue = '';
              let fileFound = '';
              
              if (hasFileValue) {
                const fileParams = paramFiles.path.parameters.parameter;
                
                // Handle both array and single object formats
                if (Array.isArray(fileParams)) {
                  const matchingParam = fileParams.find(p => p.name === param.name);
                  if (matchingParam) {
                    fileValue = matchingParam.value || '';
                    fileFound = pathFileName;
                  }
                } else if (fileParams.name === param.name) {
                  fileValue = fileParams.value || '';
                  fileFound = pathFileName;
                }
              }
              
              const isEmpty = !parameters[param.name];
              
              return (
                <div key={param.name} className="flex flex-col">
                  <label className="mb-1 font-medium">
                    {param.name}
                    {param.required && <span className="text-red-500 ml-1">*</span>}
                    <span className="text-gray-500 ml-2 text-sm">(query)</span>
                  </label>
                  <div className="flex items-center">
                    <input
                      type="text"
                      className={`border rounded p-2 flex-grow ${isEmpty && param.required ? 'border-red-500 bg-red-50' : ''}`}
                      placeholder={param.example || param.description || param.name}
                      value={parameters[param.name] || ''}
                      onChange={e => handleParameterChange(param.name, e.target.value)}
                      onKeyDown={e => {
                        e.stopPropagation();
                        if (e.nativeEvent) e.nativeEvent.stopImmediatePropagation();
                      }}
                      onClick={e => {
                        e.stopPropagation();
                        if (e.nativeEvent) e.nativeEvent.stopImmediatePropagation();
                      }}
                    />
                    {fileFound && (
                      <span className="ml-2 text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                        From file
                      </span>
                    )}
                    {isEmpty && param.required && (
                      <span className="ml-2 text-xs bg-red-100 text-red-800 px-2 py-1 rounded">
                        Missing
                      </span>
                    )}
                  </div>
                  {param.description && (
                    <p className="text-sm text-gray-500 mt-1">{param.description}</p>
                  )}
                  <div className="flex items-center mt-1">
                    <p className="text-xs text-blue-600">
                      {fileFound 
                        ? `Value loaded from: ${fileFound}`
                        : `Expected in file: ${operationId}_${lastPathSegment}_path.yaml`
                      }
                    </p>
                    <button 
                      className="ml-2 text-xs text-blue-600 hover:text-blue-800 underline"
                      onClick={() => {
                        const file = uploadedFolder.files.find(f => f.name === (fileFound || `${operationId}_${lastPathSegment}_path.yaml`));
                        if (file) {
                          viewFileContent(file);
                        } else {
                          // Create file template - check if we should create single or multi-parameter file
                          const queryParams = details.parameters.filter(p => p.in === 'query');
                          let templateContent;
                          
                          if (queryParams.length > 1) {
                            templateContent = createMultiParamFileTemplate(queryParams);
                          } else {
                            templateContent = createPathFileTemplate(param.name, param.example);
                          }
                          
                          alert(`File ${operationId}_${lastPathSegment}_path.yaml not found. You can create it with the following content:\n\n${templateContent}`);
                        }
                      }}
                    >
                      {fileFound ? "View/Edit" : "Create/Edit"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Header Parameters */}
      {details.parameters && details.parameters.filter(p => p.in === 'header').length > 0 && (
        <div className="mb-6">
          <h4 className="text-lg font-semibold mb-2">Headers</h4>
          <div className="space-y-3">
            {details.parameters.filter(p => p.in === 'header').map(param => {
              // Check if we have a value from headers file
              const headersFileName = `${operationId}_${lastPathSegment}_header.yaml`;
              const hasFileValue = paramFiles.headers && 
                paramFiles.headers.headers && 
                paramFiles.headers.headers.header;
              
              let fileValue = '';
              let fileFound = '';
              
              if (hasFileValue) {
                const headers = paramFiles.headers.headers.header;
                
                // Handle both array and single object formats
                if (Array.isArray(headers)) {
                  const matchingHeader = headers.find(h => h.name === param.name);
                  if (matchingHeader) {
                    fileValue = matchingHeader.value || '';
                    fileFound = headersFileName;
                  }
                } else if (headers.name === param.name) {
                  fileValue = headers.value || '';
                  fileFound = headersFileName;
                }
              }
              
              const isEmpty = !headerParameters[param.name];
              
              return (
                <div key={param.name} className="flex flex-col">
                  <label className="mb-1 font-medium">
                    {param.name}
                    {param.required && <span className="text-red-500 ml-1">*</span>}
                    <span className="text-gray-500 ml-2 text-sm">(header)</span>
                  </label>
                  <div className="flex items-center">
                    <input
                      type="text"
                      className={`border rounded p-2 flex-grow ${isEmpty && param.required ? 'border-red-500 bg-red-50' : ''}`}
                      placeholder={param.example || param.description || param.name}
                      value={headerParameters[param.name] || ''}
                      onChange={e => handleHeaderChange(param.name, e.target.value)}
                      onKeyDown={e => {
                        e.stopPropagation();
                        if (e.nativeEvent) e.nativeEvent.stopImmediatePropagation();
                      }}
                      onClick={e => {
                        e.stopPropagation();
                        if (e.nativeEvent) e.nativeEvent.stopImmediatePropagation();
                      }}
                    />
                    {fileFound && (
                      <span className="ml-2 text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                        From file
                      </span>
                    )}
                    {isEmpty && param.required && (
                      <span className="ml-2 text-xs bg-red-100 text-red-800 px-2 py-1 rounded">
                        Missing
                      </span>
                    )}
                  </div>
                  {param.description && (
                    <p className="text-sm text-gray-500 mt-1">{param.description}</p>
                  )}
                  <div className="flex items-center mt-1">
                    <p className="text-xs text-blue-600">
                      {fileFound 
                        ? `Value loaded from: ${fileFound}`
                        : `Expected in file: ${operationId}_${lastPathSegment}_header.yaml`
                      }
                    </p>
                    <button 
                      className="ml-2 text-xs text-blue-600 hover:text-blue-800 underline"
                      onClick={() => {
                        const file = uploadedFolder.files.find(f => f.name === (fileFound || `${operationId}_${lastPathSegment}_header.yaml`));
                        if (file) {
                          viewFileContent(file);
                        } else {
                          // Create header file template
                          const headerParams = details.parameters.filter(p => p.in === 'header');
                          const templateContent = createHeaderFileTemplate(headerParams);
                          
                          alert(`File ${operationId}_${lastPathSegment}_header.yaml not found. You can create it with the following content:\n\n${templateContent}`);
                        }
                      }}
                    >
                      {fileFound ? "View/Edit" : "Create/Edit"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Request Body */}
      {details.requestBody && (
        <div className="mb-6">
          <h4 className="text-lg font-semibold mb-2">
            Request Body
            {schemaFile && (
              <span className="ml-2 text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                From file: {schemaFileName}.json
              </span>
            )}
            {details.requestBody.required && !schemaFile && (
              <span className="ml-2 text-xs bg-red-100 text-red-800 px-2 py-1 rounded">
                Required schema missing
              </span>
            )}
          </h4>
          <div className="relative" onClick={e => e.stopPropagation()}>
            <textarea
              ref={requestBodyRef}
              className="w-full h-60 font-mono text-sm p-2 border rounded"
              value={requestBody}
              onChange={e => {
                setRequestBody(e.target.value);
                setRequestBodyCursorPosition(e.target.selectionStart);
              }}
              onKeyDown={e => {
                e.stopPropagation();
                if (e.nativeEvent) e.nativeEvent.stopImmediatePropagation();
              }}
              onClick={e => {
                e.stopPropagation();
                if (e.nativeEvent) e.nativeEvent.stopImmediatePropagation();
                setRequestBodyCursorPosition(e.target.selectionStart);
              }}
              onFocus={e => {
                e.stopPropagation();
                if (e.nativeEvent) e.nativeEvent.stopImmediatePropagation();
              }}
            />
          </div>
          <div className="flex items-center mt-1">
            <p className="text-xs text-blue-600">
              {schemaFile && schemaFileName
                ? `Body loaded from: ${schemaFileName}.json`
                : `Expected in file: ${details.requestBody.content && 
                   details.requestBody.content['application/json'] && 
                   details.requestBody.content['application/json'].schema &&
                   details.requestBody.content['application/json'].schema.items &&
                   details.requestBody.content['application/json'].schema.items.$ref
                  ? details.requestBody.content['application/json'].schema.items.$ref.split('/').pop() + '.json'
                  : (details.requestBody.content && 
                     details.requestBody.content['application/json'] && 
                     details.requestBody.content['application/json'].schema &&
                     details.requestBody.content['application/json'].schema.$ref
                    ? details.requestBody.content['application/json'].schema.$ref.split('/').pop() + '.json'
                    : 'schema.json')}`
              }
            </p>
            <button 
              className="ml-2 text-xs text-blue-600 hover:text-blue-800 underline"
              onClick={() => {
                const fileName = schemaFileName + '.json';
                const file = uploadedFolder.files.find(f => f.name === fileName);
                if (file) {
                  viewFileContent(file);
                } else {
                  // Create template for schema file
                  alert(`File ${fileName} not found. You can create it with the content of the request body.`);
                }
              }}
            >
              {schemaFile ? "View/Edit" : "Create/Edit"}
            </button>
          </div>
        </div>
      )}

      <div className="mb-6">
        <button
          className={`py-2 px-4 rounded ${
            allRequiredFieldsPresent 
              ? 'bg-blue-500 hover:bg-blue-600 text-white cursor-pointer' 
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }`}
          onClick={handleTest}
          disabled={isLoading || !allRequiredFieldsPresent}
          title={allRequiredFieldsPresent ? "Test this endpoint" : "Fill in all required fields to enable testing"}
        >
          {isLoading ? 'Testing...' : 'Test Endpoint'}
        </button>
        
        {!allRequiredFieldsPresent && (
          <p className="mt-2 text-sm text-red-500">
            Please fill in all required fields to enable testing
          </p>
        )}
      </div>

      {response && (
        <div className="mb-6">
          <h4 className="text-lg font-semibold mb-2">Response</h4>
          <div className="bg-gray-100 p-3 rounded">
            <div className="flex items-center mb-2">
              <span className={`
                inline-block px-2 py-1 text-xs font-bold rounded mr-2
                ${response.status < 300 ? 'bg-green-100 text-green-800' : ''}
                ${response.status >= 300 && response.status < 400 ? 'bg-yellow-100 text-yellow-800' : ''}
                ${response.status >= 400 ? 'bg-red-100 text-red-800' : ''}
              `}>
                {response.status}
              </span>
              <span>{response.statusText}</span>
            </div>
            <pre className="bg-white p-3 rounded border overflow-auto max-h-60">
              {typeof response.body === 'string' 
                ? response.body 
                : JSON.stringify(response.body, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};

export default EndpointDetails;
