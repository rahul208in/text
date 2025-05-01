#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const util = require('util');
const readFile = util.promisify(fs.readFile);
const writeFile = util.promisify(fs.writeFile);
const readdir = util.promisify(fs.readdir);
const stat = util.promisify(fs.stat);
const mkdir = util.promisify(fs.mkdir);

// Main function to generate k6 scripts
async function generateK6Scripts() {
  try {
    const folderPath = process.argv[2];
    if (!folderPath) {
      console.error('Please provide a folder path as an argument');
      process.exit(1);
    }

    console.log(`Generating k6 scripts for folder: ${folderPath}`);
    
    // Check if fitness folder exists
    const fitnessPath = path.join(folderPath, 'fitness');
    
    try {
      const fitnessStats = await stat(fitnessPath);
      if (!fitnessStats.isDirectory()) {
        console.error('Fitness is not a directory');
        process.exit(1);
      }
    } catch (err) {
      console.error('Fitness folder does not exist');
      process.exit(1);
    }

    // Find the Swagger/OpenAPI file
    const files = await readdir(fitnessPath);
    const swaggerFile = await findSwaggerFile(fitnessPath, files);
    
    if (!swaggerFile) {
      console.error('\nNo swagger/openapi file found. Please check fitness folder.');
      process.exit(1);
    }
    
    console.log(`\nFound Swagger/OpenAPI file: ${swaggerFile}`);
    
    // Parse the Swagger file
    const swaggerContent = await readFile(path.join(fitnessPath, swaggerFile), 'utf8');
    let swagger;
    try {
      swagger = JSON.parse(swaggerContent);
    } catch (error) {
      console.error('Error parsing Swagger file as JSON');
      process.exit(1);
    }

    // Create output directory for k6 scripts
    const k6Dir = path.join(folderPath, 'k6-scripts');
    try {
      await mkdir(k6Dir, { recursive: true });
      console.log(`Created k6 scripts directory: ${k6Dir}`);
    } catch (err) {
      if (err.code !== 'EEXIST') {
        console.error(`Error creating k6 scripts directory: ${err.message}`);
        process.exit(1);
      }
    }
    
    // Get base URL from Swagger
    let baseUrl = '';
    if (swagger.servers && swagger.servers.length > 0 && swagger.servers[0].url) {
      baseUrl = swagger.servers[0].url;
    } else {
      baseUrl = 'http://localhost:8080'; // Default fallback
      console.log('Warning: Using default base URL for k6 scripts');
    }
    
    // Process all endpoints
    const endpoints = [];
    
    if (swagger.paths) {
      for (const [path, pathItem] of Object.entries(swagger.paths)) {
        for (const [method, operation] of Object.entries(pathItem)) {
          if (typeof operation === 'object') { // Ensure it's an operation
            const operationId = operation.operationId;
            
            if (!operationId) {
              console.log(`Warning: Missing operationId for ${method.toUpperCase()} ${path}`);
              continue;
            }
            
            console.log(`Processing endpoint: ${operationId} (${method.toUpperCase()} ${path})`);
            
            // Extract parameters
            const queryParams = operation.parameters ? 
              operation.parameters.filter(param => param.in === 'query').map(p => p.name) : [];
            const headerParams = operation.parameters ? 
              operation.parameters.filter(param => param.in === 'header').map(p => p.name) : [];
            
            endpoints.push({
              operationId,
              path,
              method,
              queryParams,
              headerParams,
              hasRequestBody: !!operation.requestBody
            });
            
            // Generate k6 script for this endpoint
            await generateScriptForEndpoint(
              operationId,
              method,
              path,
              baseUrl,
              queryParams,
              headerParams,
              operation.requestBody,
              swagger,
              fitnessPath,
              k6Dir
            );
          }
        }
      }
    }
    
    // Create an index file that imports all the tests
    await createIndexFile(endpoints, swagger, k6Dir);
    
    console.log(`\nK6 scripts generation completed. Scripts saved to: ${k6Dir}`);
    
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

/**
 * Find a Swagger/OpenAPI file in the given directory
 */
async function findSwaggerFile(dirPath, files) {
  for (const file of files) {
    try {
      const filePath = path.join(dirPath, file);
      const stats = await stat(filePath);
      
      // Skip directories and check only files
      if (stats.isFile()) {
        const content = await readFile(filePath, 'utf8');
        const firstPortion = content.substring(0, 1000); // Get first portion of the file
        
        // Check for OpenAPI or Swagger indicators
        if (firstPortion.includes('"openapi":') || 
            firstPortion.includes('"swagger":') ||
            firstPortion.includes("'openapi':") || 
            firstPortion.includes("'swagger':")) {
          return file;
        }
      }
    } catch (error) {
      console.log(`Error reading file ${file}: ${error.message}`);
    }
  }
  return null;
}

/**
 * Parse YAML content for parameter structures
 */
function parseYamlManually(content) {
  try {
    const result = {};
    
    // Remove YAML document separator if present
    content = content.replace(/^---[\r\n]+/, '');
    
    // Case 1: Headers format with array items
    if (content.includes('headers:') && content.includes('header:')) {
      // Extract header items with dash prefix
      const headerItemsRegex = /-\s*name:\s*["']?([^"'\r\n]+)["']?[\r\n\s]*value:\s*["']?([^"'\r\n]*)["']?/g;
      const headerMatches = [...content.matchAll(headerItemsRegex)];
      
      if (headerMatches.length > 0) {
        for (const match of headerMatches) {
          const name = match[1].trim();
          const value = match[2] ? match[2].trim() : '';
          result[name] = value;
        }
        return result;
      }
    }
    
    // Case 2: Parameters format with single parameter
    if (content.includes('parameters:') && content.includes('parameter:')) {
      // Check if it's a single parameter format
      const singleParamRegex = /parameters:[\r\n\s]*parameter:[\r\n\s]*name:\s*["']?([^"'\r\n]+)["']?[\r\n\s]*value:\s*["']?([^"'\r\n]*)["']?/;
      const singleParamMatch = content.match(singleParamRegex);
      
      if (singleParamMatch) {
        const name = singleParamMatch[1].trim();
        const value = singleParamMatch[2] ? singleParamMatch[2].trim() : '';
        result[name] = value;
        return result;
      }
      
      // Check if it's a multiple parameters format (with dashes)
      const multiParamRegex = /-\s*name:\s*["']?([^"'\r\n]+)["']?[\r\n\s]*value:\s*["']?([^"'\r\n]*)["']?/g;
      const multiParamMatches = [...content.matchAll(multiParamRegex)];
      
      if (multiParamMatches.length > 0) {
        for (const match of multiParamMatches) {
          const name = match[1].trim();
          const value = match[2] ? match[2].trim() : '';
          result[name] = value;
        }
        return result;
      }
    }
    
    // Fallback to the original approach - just parse colon-separated values
    const lines = content.split('\n').map(line => line.trim()).filter(line => line && !line.startsWith('#'));
    
    for (const line of lines) {
      const colonIndex = line.indexOf(':');
      if (colonIndex > 0) {
        const key = line.substring(0, colonIndex).trim();
        const value = line.substring(colonIndex + 1).trim().replace(/^["']|["']$/g, '');
        result[key] = value;
      }
    }
    
    return result;
  } catch (error) {
    console.log('Error in YAML parsing:', error.message);
    return {};
  }
}

/**
 * Generate k6 script for a specific endpoint
 */
async function generateScriptForEndpoint(
  operationId,
  method,
  path,
  baseUrl,
  queryParamNames,
  headerParamNames,
  requestBody,
  swagger,
  fitnessPath,
  k6Dir
) {
  try {
    console.log(`Generating k6 script for ${operationId} (${method.toUpperCase()} ${path})`);
    
    // Prepare request parameters
    const headers = {};
    const params = {};
    let bodyContent = null;
    
    // Load headers from YAML file if available
    try {
      const endpointLastPart = path.split('/').filter(Boolean).pop();
      const headerFileName = `${operationId}_${endpointLastPart}_header.yaml`;
      const headerFilePath = path.join(fitnessPath, headerFileName);
      
      try {
        const headerFileStats = await stat(headerFilePath);
        if (headerFileStats.isFile()) {
          const headerContent = await readFile(headerFilePath, 'utf8');
          const headerValues = parseYamlManually(headerContent);
          
          if (Object.keys(headerValues).length > 0) {
            for (const [key, value] of Object.entries(headerValues)) {
              headers[key] = value;
            }
          }
        }
      } catch (err) {
        // If file doesn't exist, just use default headers
      }
    } catch (err) {
      console.log(`Error reading header file: ${err.message}`);
    }
    
    // Load query parameters if available
    try {
      const endpointLastPart = path.split('/').filter(Boolean).pop();
      const queryFileName = `${operationId}_${endpointLastPart}_path.yaml`;
      const queryFilePath = path.join(fitnessPath, queryFileName);
      
      try {
        const queryFileStats = await stat(queryFilePath);
        if (queryFileStats.isFile()) {
          const queryContent = await readFile(queryFilePath, 'utf8');
          const queryValues = parseYamlManually(queryContent);
          
          if (Object.keys(queryValues).length > 0) {
            for (const [key, value] of Object.entries(queryValues)) {
              params[key] = value;
            }
          }
        }
      } catch (err) {
        // If file doesn't exist, just use empty params
      }
    } catch (err) {
      console.log(`Error reading query parameter file: ${err.message}`);
    }
    
    // Load request body if available
    if (requestBody) {
      if (requestBody.content && requestBody.content['application/json']) {
        const schema = requestBody.content['application/json'].schema;
        
        if (schema) {
          let bodyFileName = null;
          
          // Get schema file for request body
          if (schema.type === 'array' && schema.items && schema.items.$ref) {
            bodyFileName = schema.items.$ref.split('/').pop() + '.json';
          } else if (schema.$ref) {
            bodyFileName = schema.$ref.split('/').pop() + '.json';
          } else {
            // Look for endpoint-specific body file
            const endpointLastPart = path.split('/').filter(Boolean).pop();
            bodyFileName = `${operationId}_${endpointLastPart}_body.json`;
          }
          
          if (bodyFileName) {
            try {
              const bodyFilePath = path.join(fitnessPath, bodyFileName);
              const bodyFileStats = await stat(bodyFilePath);
              
              if (bodyFileStats.isFile()) {
                const bodyContentStr = await readFile(bodyFilePath, 'utf8');
                try {
                  bodyContent = JSON.parse(bodyContentStr);
                } catch (e) {
                  console.log(`Warning: Invalid JSON in body file ${bodyFileName}`);
                  bodyContent = `JSON.parse(${JSON.stringify(bodyContentStr)})`;
                }
              }
            } catch (err) {
              // If body file doesn't exist, just use empty body
            }
          }
        }
      } else if (requestBody.content && requestBody.content['multipart/form-data']) {
        // For multipart/form-data, we'd need more complex handling in k6
        const schema = requestBody.content['multipart/form-data'].schema;
        if (schema && schema.required && Array.isArray(schema.required)) {
          bodyContent = "// Multipart form data - implement according to specific needs\n";
          bodyContent += "// Required fields: " + schema.required.join(', ') + "\n";
          bodyContent += "let formData = new FormData();\n";
          
          for (const field of schema.required) {
            try {
              const fieldFilePath = path.join(fitnessPath, `${field}.json`);
              await stat(fieldFilePath);
              bodyContent += `// formData.append('${field}', open('${field}.json', 'b'));\n`;
            } catch (err) {
              bodyContent += `// formData.append('${field}', 'some_value');\n`;
            }
          }
        }
      }
    }
    
    // Generate k6 script content
    const scriptContent = generateK6ScriptContent(
      operationId,
      method,
      path,
      baseUrl,
      headers,
      params,
      bodyContent
    );
    
    // Write script to file
    const scriptFileName = `${operationId}_test.js`;
    const scriptFilePath = path.join(k6Dir, scriptFileName);
    await writeFile(scriptFilePath, scriptContent);
    
    console.log(`Created k6 script: ${scriptFileName}`);
    
  } catch (err) {
    console.error(`Error generating k6 script for ${operationId}: ${err.message}`);
  }
}

/**
 * Generate content for a k6 script file
 */
function generateK6ScriptContent(operationId, method, path, baseUrl, headers, params, body) {
  // Create URL with path parameters
  const urlPath = path.replace(/{([^}]+)}/g, (match, paramName) => {
    return `\${params.${paramName}}`;
  });
  
  let content = `// K6 Performance Test for ${operationId}
import http from 'k6/http';
import { check, sleep } from 'k6';

// Test configuration
export const options = {
  stages: [
    { duration: '30s', target: 5 },    // Ramp-up to 5 users
    { duration: '1m', target: 5 },     // Stay at 5 users for 1 minute
    { duration: '30s', target: 0 }     // Ramp-down to 0 users
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'], // 95% of requests must complete below 2s
  },
};

// Parameters for the test 
const BASE_URL = '${baseUrl}';

// Test data
const params = ${JSON.stringify(params, null, 2)};

// Request headers
const headers = ${JSON.stringify(headers, null, 2)};

// Default function
export default function() {
  // Build URL with query parameters if needed
  let url = \`\${BASE_URL}${urlPath}\`;\n`;
  
  // Add query parameters to URL if present
  if (Object.keys(params).length > 0) {
    content += `
  // Add query parameters
  const queryParams = {
${Object.entries(params).map(([key, value]) => `    ${key}: params.${key}`).join(',\n')}
  };
  
  // Convert query params to URL format
  const queryString = Object.entries(queryParams)
    .map(([key, value]) => \`\${key}=\${encodeURIComponent(value)}\`)
    .join('&');
    
  if (queryString) {
    url += '?' + queryString;
  }\n`;
  }

  // Add request body if needed
  let requestOptions = '';
  if (body) {
    if (typeof body === 'string') {
      content += `
  // Request body
  ${body}\n`;
      
      if (body.includes('formData')) {
        requestOptions = `, { headers: headers }`;
      } else {
        requestOptions = `, JSON.stringify(payload), { headers: headers }`;
      }
    } else {
      content += `
  // Request body
  const payload = ${JSON.stringify(body, null, 2)};\n`;
      requestOptions = `, JSON.stringify(payload), { headers: headers }`;
    }
  } else {
    requestOptions = `, { headers: headers }`;
  }

  // Add the HTTP request
  content += `
  // Make HTTP request
  const response = http.${method.toLowerCase()}(url${requestOptions});
  
  // Check if response is successful
  check(response, {
    'Status is 2xx': (r) => r.status >= 200 && r.status < 300,
    'Response time < 500ms': (r) => r.timings.duration < 500,
    'Response body not empty': (r) => r.body.length > 0,
  });
  
  // Wait between requests
  sleep(1);
}\n`;

  return content;
}

/**
 * Create an index file that imports all the tests
 */
async function createIndexFile(endpoints, swagger, k6Dir) {
  try {
    const testFiles = endpoints.map(e => `${e.operationId}_test.js`);
    let indexContent = `// K6 Test Suite for ${swagger.info ? swagger.info.title : 'API'}\n\n`;
    indexContent += `import { group, sleep } from 'k6';\n\n`;
    
    for (const [i, file] of testFiles.entries()) {
      const varName = `test${i + 1}`;
      indexContent += `import { default as ${varName} } from './${file}';\n`;
    }
    
    indexContent += `\nexport default function() {\n`;
    for (const [i, endpoint] of endpoints.entries()) {
      indexContent += `  group("${endpoint.operationId}", function() { test${i + 1}(); });\n`;
      indexContent += `  sleep(1);\n`;
    }
    indexContent += `}\n`;
    
    await writeFile(path.join(k6Dir, 'index.js'), indexContent);
    console.log(`Created k6 test suite index file`);
    
    // Create a README file with instructions
    const readmeContent = `# Grafana K6 Test Scripts

Generated from Swagger/OpenAPI definition on ${new Date().toISOString().split('T')[0]}

## Running the tests

To run all tests:
\`\`\`
k6 run index.js
\`\`\`

To run a specific test:
\`\`\`
k6 run [test_file_name].js
\`\`\`

## Configuration

You can modify the test options in each script to adjust:
- Duration
- Number of virtual users
- Ramp-up time
- Thresholds

## Documentation
- [k6 Documentation](https://k6.io/docs/)
- [Grafana K6](https://grafana.com/docs/k6/latest/)
`;
    
    await writeFile(path.join(k6Dir, 'README.md'), readmeContent);
    console.log(`Created README file with instructions`);
    
  } catch (err) {
    console.error(`Error creating index file: ${err.message}`);
  }
}

// Run the script
generateK6Scripts();
