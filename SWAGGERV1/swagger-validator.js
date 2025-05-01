#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const util = require('util');
const readFile = util.promisify(fs.readFile);
const readdir = util.promisify(fs.readdir);
const stat = util.promisify(fs.stat);

// Report object to store validation issues
const validationReport = {
  missingServerUrl: false,
  endpoints: {},
  missingFiles: [],
  emptyValues: []
};

/**
 * Main function to validate Swagger and supporting files
 */
async function validateSwaggerAndFiles() {
  try {
    const folderPath = process.argv[2];
    if (!folderPath) {
      console.error('Please provide a folder path as an argument');
      process.exit(1);
    }

    console.log(`Checking folder: ${folderPath}`);
    
    // 1. Check if fitness folder exists
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

    // 2. List files in the fitness folder
    const files = await readdir(fitnessPath);
    console.log('\nFiles in fitness folder:');
    files.forEach(file => console.log(`- ${file}`));

    // 3. Find and validate the Swagger/OpenAPI file
    const swaggerFile = await findSwaggerFile(fitnessPath, files);
    if (!swaggerFile) {
      console.error('\nNo swagger/openapi file found. Please check fitness folder.');
      process.exit(1);
    }
    
    console.log(`\nFound Swagger/OpenAPI file: ${swaggerFile}`);
    
    // 4. Parse and validate the Swagger file
    const swaggerContent = await readFile(path.join(fitnessPath, swaggerFile), 'utf8');
    let swagger;
    try {
      // Try to parse as JSON
      swagger = JSON.parse(swaggerContent);
    } catch (error) {
      try {
        // If JSON parsing fails, try to parse as YAML
        console.log("JSON parsing failed, attempting to parse as YAML...");
        // Since Node.js doesn't have built-in YAML support, we'll need an external library
        // For now, we'll tell the user they need to install a YAML parser
        console.error('YAML parsing is not supported in this version.');
        console.error('Please convert your Swagger/OpenAPI file to JSON format.');
        console.error('Or install the yaml package: npm install yaml');
        process.exit(1);
        
        // If you want to add YAML support, you would add the following:
        // const YAML = require('yaml');
        // swagger = YAML.parse(swaggerContent);
      } catch (yamlError) {
        console.error('Error parsing Swagger file as JSON or YAML');
        process.exit(1);
      }
    }

    // Validate the Swagger file
    await validateSwagger(swagger, fitnessPath);
    
    // Generate and display final report
    generateReport();
    
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
        console.log(`Checking file: ${file}`);
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
 * Validate the Swagger file and related supporting files
 */
async function validateSwagger(swagger, fitnessPath) {
  // 4.1 Check for server URL
  if (!swagger.servers || swagger.servers.length === 0 || !swagger.servers[0].url) {
    validationReport.missingServerUrl = true;
    console.log('Warning: Missing server URL in Swagger file');
  }

  // 4.2 & 4.3 Process endpoints and their operations
  if (swagger.paths) {
    for (const [endpoint, pathItem] of Object.entries(swagger.paths)) {
      console.log(`\nValidating endpoint: ${endpoint}`);
      
      // Process each HTTP method (get, post, put, etc.)
      for (const [method, operation] of Object.entries(pathItem)) {
        if (typeof operation === 'object') { // Ensure it's an operation
          const operationId = operation.operationId;
          
          if (!operationId) {
            console.log(`Warning: Missing operationId for ${method.toUpperCase()} ${endpoint}`);
            continue;
          }
          
          console.log(`- Operation ID: ${operationId}`);
          validationReport.endpoints[`${operationId}`] = { 
            path: endpoint, 
            method: method,
            queryParams: [],
            headerParams: [],
            bodyContent: null,
            issues: []
          };

          // 4.4 Validate parameters
          if (operation.parameters) {
            await validateParameters(operation.parameters, operationId, endpoint, fitnessPath);
          }
          
          // Validate request body if present
          if (operation.requestBody) {
            await validateRequestBody(operation.requestBody, operationId, endpoint, swagger, fitnessPath);
          }
        }
      }
    }
  }
}

/**
 * Validate operation parameters (query, header)
 */
async function validateParameters(parameters, operationId, endpoint, fitnessPath) {
  const queryParams = parameters.filter(param => param.in === 'query');
  const headerParams = parameters.filter(param => param.in === 'header');
  
  // Process query parameters
  if (queryParams.length > 0) {
    console.log(`  - Query parameters: ${queryParams.map(p => p.name).join(', ')}`);
    
    // Extract just the last part of the path (after the last forward slash)
    const endpointLastPart = endpoint.split('/').filter(Boolean).pop();
    const queryParamFileName = `${operationId}_${endpointLastPart}_path.yaml`;
    await validateParameterFile(queryParamFileName, queryParams, 'query', operationId, fitnessPath);
  }
  
  // Process header parameters
  if (headerParams.length > 0) {
    console.log(`  - Header parameters: ${headerParams.map(p => p.name).join(', ')}`);
    
    // Extract just the last part of the path (after the last forward slash)
    const endpointLastPart = endpoint.split('/').filter(Boolean).pop();
    const headerParamFileName = `${operationId}_${endpointLastPart}_header.yaml`;
    await validateParameterFile(headerParamFileName, headerParams, 'header', operationId, fitnessPath);
  }
}

/**
 * Validate parameter file existence and content
 */
async function validateParameterFile(fileName, params, paramType, operationId, fitnessPath) {
  const filePath = path.join(fitnessPath, fileName);
  
  try {
    await stat(filePath);
    console.log(`    Found ${paramType} parameter file: ${fileName}`);
    
    // Read the file content
    const content = await readFile(filePath, 'utf8');
    
    if (!content.trim()) {
      console.log(`    Warning: ${fileName} is empty`);
      validationReport.emptyValues.push({
        file: fileName,
        type: paramType,
        operationId: operationId
      });
    } else {
      // Here you could add more validation for the parameter values if needed
      console.log(`    ${paramType} parameter file has content`);
    }
    
  } catch (err) {
    console.log(`    Warning: ${paramType} parameter file ${fileName} not found`);
    validationReport.missingFiles.push({
      file: fileName,
      type: paramType,
      operationId: operationId
    });
  }
}

/**
 * Validate request body
 */
async function validateRequestBody(requestBody, operationId, endpoint, swagger, fitnessPath) {
  if (!requestBody.content || !requestBody.content['application/json']) {
    return;
  }
  
  console.log('  - Request body: application/json');
  
  const schema = requestBody.content['application/json'].schema;
  if (!schema) return;
  
  // Check for array items with $ref
  if (schema.type === 'array' && schema.items && schema.items.$ref) {
    const refPath = schema.items.$ref;
    await validateSchemaRef(refPath, operationId, swagger, fitnessPath);
  } 
  // Or direct $ref to a schema
  else if (schema.$ref) {
    await validateSchemaRef(schema.$ref, operationId, swagger, fitnessPath);
  }
}

/**
 * Validate a schema reference
 */
async function validateSchemaRef(refPath, operationId, swagger, fitnessPath) {
  // Extract schema name from the ref path (e.g., "#/components/schemas/ReportRequest" -> "ReportRequest")
  const schemaName = refPath.split('/').pop();
  
  console.log(`    Referenced schema: ${schemaName}`);
  
  // Check if schema exists in the Swagger file
  if (swagger.components && 
      swagger.components.schemas && 
      swagger.components.schemas[schemaName]) {
    
    // Look for the schema JSON file
    const schemaFileName = `${schemaName}.json`;
    const schemaFilePath = path.join(fitnessPath, schemaFileName);
    
    try {
      await stat(schemaFilePath);
      console.log(`    Found schema file: ${schemaFileName}`);
      
      // Read the file content
      const content = await readFile(schemaFilePath, 'utf8');
      
      if (!content.trim()) {
        console.log(`    Warning: ${schemaFileName} is empty`);
        validationReport.emptyValues.push({
          file: schemaFileName,
          type: 'body',
          operationId: operationId
        });
      } else {
        console.log(`    Schema file has content`);
      }
      
    } catch (err) {
      console.log(`    Warning: Schema file ${schemaFileName} not found`);
      validationReport.missingFiles.push({
        file: schemaFileName,
        type: 'body',
        operationId: operationId
      });
    }
  }
}

/**
 * Generate validation report
 */
function generateReport() {
  console.log('\n====================================');
  console.log('      VALIDATION REPORT');
  console.log('====================================\n');
  
  // Report server URL issue
  if (validationReport.missingServerUrl) {
    console.log('■ Server URL is missing in the Swagger file');
  }
  
  // Report missing files
  if (validationReport.missingFiles.length > 0) {
    console.log('\n■ Missing files:');
    validationReport.missingFiles.forEach(item => {
      console.log(`  - ${item.file} (${item.type} parameter for operation: ${item.operationId})`);
    });
  }
  
  // Report empty values
  if (validationReport.emptyValues.length > 0) {
    console.log('\n■ Files with empty values:');
    validationReport.emptyValues.forEach(item => {
      console.log(`  - ${item.file} (${item.type} parameter for operation: ${item.operationId})`);
    });
  }
  
  // Report endpoints validation summary
  console.log('\n■ Endpoints validated:');
  Object.entries(validationReport.endpoints).forEach(([operationId, details]) => {
    console.log(`  - ${operationId} (${details.method.toUpperCase()} ${details.path})`);
  });
  
  // Final validation status
  const hasIssues = validationReport.missingServerUrl || 
                    validationReport.missingFiles.length > 0 || 
                    validationReport.emptyValues.length > 0;
  
  console.log('\n====================================');
  if (hasIssues) {
    console.log('✘ Validation completed with issues');
  } else {
    console.log('✓ Validation completed successfully');
  }
  console.log('====================================');
}

// Run the validation
validateSwaggerAndFiles();
