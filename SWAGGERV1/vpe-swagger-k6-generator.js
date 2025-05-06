#!/usr/bin/env node

"use strict"; // Enable strict mode

const fs = require('fs');
const path = require('path'); // Require path only once
const util = require('util');
const readFile = util.promisify(fs.readFile);
const readdir = util.promisify(fs.readdir);
const stat = util.promisify(fs.stat);

// --- Constants ---
const SWAGGER_INDICATORS = [
  '"openapi":',
  '"swagger":',
  "'openapi':",
  "'swagger':"
];

// --- Helper Functions ---
async function readFileContent(filePath) {
  try {
    return await readFile(filePath, 'utf8');
  } catch (error) {
    console.error(`Error reading file ${filePath}: ${error.message}`);
    return null;
  }
}

async function directoryExists(dirPath) {
  try {
    const stats = await stat(dirPath);
    return stats.isDirectory();
  } catch (err) {
    return false;
  }
}

async function fileExists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch (err) {
    return false;
  }
}

function isSwaggerFileContent(content) {
  const firstPortion = content.substring(0, 1000);
  return SWAGGER_INDICATORS.some(indicator => firstPortion.includes(indicator));
}

async function findSwaggerFile(dirPath, files, pathModule) { // 1. Definition: pathModule parameter
  for (const file of files) {
    const filePath = pathModule.join(dirPath, file); // 3. Use: pathModule.join
    if (await fileExists(filePath)) {
      console.log(`Checking file: ${file}`);
      const content = await readFileContent(filePath);
      if (content && isSwaggerFileContent(content)) {
        return file;
      }
    }
  }
  return null;
}

function parseYamlManually(content) {
  try {
    const result = {};
    content = content.replace(/^---[\r\n]+/, '');

    const headerItemsRegex = /-\s*name:\s*["']?([^"'\r\n]+)["']?[\r\n\s]*value:\s*["']?([^"'\r\n]*)["']?/g;
    const headerMatches = [...content.matchAll(headerItemsRegex)];

    if (headerMatches.length > 0) {
      for (const match of headerMatches) {
        const name = match[1].trim();
        const value = match[2] ? match[2].trim() : '';
        result[name] = value;
        console.log(`    Found header parameter: ${name} = ${value || '(empty)'}`);
      }
      return result;
    }

    const singleParamRegex = /parameters:[\r\n\s]*parameter:[\r\n\s]*name:\s*["']?([^"'\r\n]+)["']?[\r\n\s]*value:\s*["']?([^"'\r\n]*)["']?/;
    const singleParamMatch = content.match(singleParamRegex);

    if (singleParamMatch) {
      const name = singleParamMatch[1].trim();
      const value = singleParamMatch[2] ? singleParamMatch[2].trim() : '';
      result[name] = value;
      console.log(`    Found single parameter: ${name} = ${value || '(empty)'}`);
      return result;
    }

    const multiParamRegex = /-\s*name:\s*["']?([^"'\r\n]+)["']?[\r\n\s]*value:\s*["']?([^"'\r\n]*)["']?/g;
    const multiParamMatches = [...content.matchAll(multiParamRegex)];

    if (multiParamMatches.length > 0) {
      for (const match of multiParamMatches) {
        const name = match[1].trim();
        const value = match[2] ? match[2].trim() : '';
        result[name] = value;
        console.log(`    Found parameter: ${name} = ${value || '(empty)'}`);
      }
      return result;
    }

    const lines = content.split('\n').map(line => line.trim()).filter(line => line && !line.startsWith('#'));

    for (const line of lines) {
      const colonIndex = line.indexOf(':');
      if (colonIndex > 0) {
        const key = line.substring(0, colonIndex).trim();
        const value = line.substring(colonIndex + 1).trim().replace(/^["']|["']$/g, '');
        result[key] = value;
        console.log(`    Found direct parameter: ${key} = ${value || '(empty)'}`);
      }
    }

    return result;
  } catch (error) {
    console.log('Error in YAML parsing:', error.message);
    return {};
  }
}

/**
 * @returns {ValidationReport}
 */
function createValidationReport() { // ADDED BACK THIS FUNCTION
  return {
    missingServerUrl: false,
    endpoints: {},
    missingFiles: [],
    emptyValues: []
  };
}

async function validateParameterFile(fileName, params, paramType, operationId, fitnessPath, validationReport, pathModule) { // 1. Definition: pathModule parameter
  const filePath = pathModule.join(fitnessPath, fileName); // 3. Use: pathModule.join
  const paramNames = params.map(p => p.name);

  try {
    const fileExists = await util.promisify(fs.stat)(filePath);
  } catch (err) {
    console.log(`    Warning: ${paramType} parameter file ${fileName} not found`);
    validationReport.missingFiles.push({
      file: fileName,
      type: paramType,
      operationId: operationId
    });
    return;
  }

  console.log(`    Found ${paramType} parameter file: ${fileName}`);
  const content = await readFileContent(filePath);

  if (!content || !content.trim()) {
    console.log(`    Warning: ${fileName} is empty`);
    validationReport.emptyValues.push({
      file: fileName,
      type: paramType,
      operationId: operationId
    });
    return;
  }

  console.log(`    ${paramType} parameter file has content`);

  const paramValues = parseYamlManually(content);

  if (Object.keys(paramValues).length === 0) {
    console.log(`    Warning: Unable to parse content of ${fileName} or no parameters found`);
    validationReport.emptyValues.push({
      file: fileName,
      type: paramType,
      operationId: operationId,
      issue: "Cannot parse content or no parameters found"
    });
    return;
  }

  const missingParams = [];
  const emptyParams = [];

  for (const paramName of paramNames) {
    if (!(paramName in paramValues)) {
      missingParams.push(paramName);
    } else if (paramValues[paramName] === "" || paramValues[paramName] === null) {
      emptyParams.push(paramName);
    } else {
      console.log(`    ✓ Parameter '${paramName}' is present and has value: ${paramValues[paramName]}`);
    }
  }

  if (missingParams.length > 0) {
    console.log(`    Warning: Parameters missing in ${fileName}: ${missingParams.join(', ')}`);
    validationReport.endpoints[operationId].issues.push({
      file: fileName,
      missingParameters: missingParams
    });
  }

  if (emptyParams.length > 0) {
    console.log(`    Warning: Empty parameters in ${fileName}: ${emptyParams.join(', ')}`);
    validationReport.endpoints[operationId].issues.push({
      file: fileName,
      emptyParameters: emptyParams
    });
  }
}

async function validateBodyFile(fileName, operationId, fitnessPath, validationReport, pathModule) { // 1. Definition: pathModule parameter
  const filePath = pathModule.join(fitnessPath, fileName); // 3. Use: pathModule.join

  try {
    const fileExists = await util.promisify(fs.stat)(filePath);
  } catch (err) {
    console.log(`    Warning: Body file ${fileName} not found`);
    validationReport.missingFiles.push({
      file: fileName,
      type: 'body',
      operationId: operationId
    });
    return;
  }

  console.log(`    Found body file: ${fileName}`);
  const content = await readFileContent(filePath);

  if (!content || !content.trim()) {
    console.log(`    Warning: ${fileName} is empty`);
    validationReport.emptyValues.push({
      file: fileName,
      type: 'body',
      operationId: operationId
    });
    return;
  }

  console.log(`    ✓ Body file has content - validated successfully`);

  // Store the body file name in the validationReport
  if (validationReport.endpoints[operationId]) {
    validationReport.endpoints[operationId].bodyFile = fileName;
  } else {
    console.warn(`Warning: operationId ${operationId} not found in validationReport.endpoints`);
  }
}

async function validateSchemaRef(refPath, operationId, swagger, fitnessPath, validationReport, pathModule) { // 1. Definition: pathModule parameter
  const schemaName = refPath.split('/').pop();
  console.log(`    Referenced schema: ${schemaName}`);

  if (swagger.components && swagger.components.schemas && swagger.components.schemas[schemaName]) {
    const schemaFileName = `${schemaName}.json`;
    const schemaFilePath = pathModule.join(fitnessPath, schemaFileName); // 3. Use: pathModule.join

    try {
      const fileExists = await util.promisify(fs.stat)(schemaFilePath);
    } catch (err) {
      console.log(`    Warning: Schema file ${schemaFileName} not found`);
      validationReport.missingFiles.push({
        file: schemaFileName,
        type: 'body',
        operationId: operationId
      });
      return;
    }

    console.log(`    Found schema file: ${schemaFileName}`);
    const content = await readFileContent(schemaFilePath);

    if (!content || !content.trim()) {
      console.log(`    Warning: ${schemaFileName} is empty`);
      validationReport.emptyValues.push({
        file: schemaFileName,
        type: 'body',
        operationId: operationId
      });
      return;
    }

    console.log(`    ✓ Schema file has content - validated successfully`);
  }
}

async function validateRequestBody(requestBody, operationId, endpoint, swagger, fitnessPath, validationReport, pathModule) { // 1. Definition: pathModule parameter
  if (!requestBody.content) {
    return;
  }

  if (requestBody.content['application/json']) {
    console.log('  - Request body: application/json');
    const schema = requestBody.content['application/json'].schema;
    if (!schema) return;

    if (schema.type === 'array' && schema.items && schema.items.$ref) {
      const refPath = schema.items.$ref;
      const schemaName = refPath.split('/').pop();
      console.log(`    Referenced schema: ${schemaName}`);
      const schemaFileName = `${schemaName}.json`;
      await validateBodyFile(schemaFileName, operationId, fitnessPath, validationReport, pathModule); // 2. Call: Pass pathModule
    } else if (schema.$ref) {
      const refPath = schema.$ref;
      const schemaName = refPath.split('/').pop();
      console.log(`    Referenced schema: ${schemaName}`);
      const schemaFileName = `${schemaName}.json`;
      await validateBodyFile(schemaFileName, operationId, fitnessPath, validationReport, pathModule); // 2. Call: Pass pathModule
    }
  } else if (requestBody.content['multipart/form-data']) {
    console.log('  - Request body: multipart/form-data');
    const schema = requestBody.content['multipart/form-data'].schema;
    if (!schema || !schema.required || !Array.isArray(schema.required)) {
      return;
    }

    for (const requiredField of schema.required) {
      console.log(`    Required field: ${requiredField}`);
      const fileName = `${requiredField}.json`;
      await validateBodyFile(fileName, operationId, fitnessPath, validationReport, pathModule); // 2. Call: Pass pathModule
    }
  }
}

async function validateParameters(parameters, operationId, endpoint, fitnessPath, validationReport, pathModule) { // 1. Definition: pathModule parameter
  const queryParams = parameters.filter(param => param.in === 'query');
  const headerParams = parameters.filter(param => param.in === 'header');

  const endpointLastPart = endpoint.split('/').filter(Boolean).pop();

  if (queryParams.length > 0) {
    console.log(`  - Query parameters: ${queryParams.map(p => p.name).join(', ')}`);
    validationReport.endpoints[operationId].queryParams = queryParams.map(p => p.name);
    const queryParamFileName = `${operationId}_${endpointLastPart}_path.yaml`;
    await validateParameterFile(queryParamFileName, queryParams, 'query', operationId, fitnessPath, validationReport, pathModule); // 2. Call: Pass pathModule
  }

  if (headerParams.length > 0) {
    console.log(`  - Header parameters: ${headerParams.map(p => p.name).join(', ')}`);
    validationReport.endpoints[operationId].headerParams = headerParams.map(p => p.name);
    const headerParamFileName = `${operationId}_${endpointLastPart}_header.yaml`;
    await validateParameterFile(headerParamFileName, headerParams, 'header', operationId, fitnessPath, validationReport, pathModule); // 2. Call: Pass pathModule
  }
}

async function validateSwagger(swagger, fitnessPath, validationReport, pathModule) { // 1. Definition: pathModule parameter
  if (!swagger.servers || swagger.servers.length === 0 || !swagger.servers[0].url) {
    validationReport.missingServerUrl = true;
    console.log('Warning: Missing server URL in Swagger file');
  }

  if (swagger.paths) {
    for (const [endpoint, pathItem] of Object.entries(swagger.paths)) {
      console.log(`\nValidating endpoint: ${endpoint}`);

      for (const [method, operation] of Object.entries(pathItem)) {
        if (typeof operation === 'object') {
          const operationId = operation.operationId;

          if (!operationId) {
            console.log(`Warning: Missing operationId for ${method.toUpperCase()} ${endpoint}`);
            continue;
          }

          console.log(`- Operation ID: ${operationId}`);
          validationReport.endpoints[operationId] = {
            path: endpoint,
            method: method,
            queryParams: [],
            headerParams: [],
            bodyContent: null,
            issues: []
          };

          if (operation.parameters) {
            await validateParameters(operation.parameters, operationId, endpoint, fitnessPath, validationReport, pathModule); // 2. Call: Pass pathModule
          }

          if (operation.requestBody) {
            await validateRequestBody(operation.requestBody, operationId, endpoint, swagger, fitnessPath, validationReport, pathModule); // 2. Call: Pass pathModule
          }
        }
      }
    }
  }
}

function generateK6Script(swagger, validationReport, pathModule, fsModule) {
  if (validationReport.missingServerUrl) {
    console.error("Cannot generate k6 script: Missing server URL in Swagger file");
    return null;
  }

  const baseUrl = swagger.servers[0].url;
  let k6Code = `import http from 'k6/http';\nimport { check, Trend } from 'k6';\n\nexport const options = {\n  vus: 10,\n  duration: '10s',\n};\n\n`;

  // Add Trend metrics
  for (const operationId in validationReport.endpoints) {
    if (!validationReport.endpoints.hasOwnProperty(operationId)) continue;
    k6Code += `const ${operationId}Trend = new Trend('${operationId}');\n`;
  }

  k6Code += `\nexport default function () {\n`;

  for (const operationId in validationReport.endpoints) {
    if (!validationReport.endpoints.hasOwnProperty(operationId)) continue;

    const endpointDetails = validationReport.endpoints[operationId];
    const { path, method } = endpointDetails;

    // Construct URL
    const urlVariableName = `${operationId}_url`;
    const bodyVariableName = `${operationId}_body`;
    const headersVariableName = `${operationId}_headers`;
    const paramsVariableName = `${operationId}_params`;
    const resVariableName = `${operationId}_res`;

    k6Code += `\n  // ${operationId}: ${method.toUpperCase()} ${path}\n`;

    // Construct URL
    k6Code += `  const ${urlVariableName} = '${baseUrl}${path}';\n`;

    // Handle body
    let bodyContent = 'null';
    let bodyFile = null;

    // Get the body file name from the validationReport
    if (endpointDetails.bodyFile) {
      bodyFile = endpointDetails.bodyFile;
    }

    let bodyFilePath = null;
    if (bodyFile) { // Add null check here
      bodyFilePath = pathModule.join(process.argv[2], 'fitness', bodyFile);
    }

    if (bodyFilePath && fsModule.existsSync(bodyFilePath)) {
      try {
        const bodyFileContent = fsModule.readFileSync(bodyFilePath, 'utf8');
        bodyContent = bodyFileContent;
        // Try to parse as JSON, if it fails, treat it as a string
        try {
          JSON.parse(bodyContent);
          k6Code += `  const ${bodyVariableName} = ${bodyContent};\n`; // If valid JSON, use directly
        } catch (e) {
          // If not valid JSON, treat as a string
          k6Code += `  const ${bodyVariableName} = \`${bodyContent}\`;\n`; // Use template literals for strings
        }
      } catch (e) {
        console.error(`Error parsing body file ${bodyFile}: ${e.message}`);
        bodyContent = 'null';
        k6Code += `  const ${bodyVariableName} = null;\n`;
      }
    } else {
      k6Code += `  const ${bodyVariableName} = null;\n`;
    }

    // Handle headers
    let headers = {};
    if (endpointDetails.headerParams && endpointDetails.headerParams.length > 0) {
      const headerParamFile = `${operationId}_${path.split('/').filter(Boolean).pop()}_header.yaml`;
      const headerParamFilePath = pathModule.join(process.argv[2], 'fitness', headerParamFile);

      if (fsModule.existsSync(headerParamFilePath)) {
        try {
          const headerParamContent = fsModule.readFileSync(headerParamFilePath, 'utf8');
          headers = parseYamlManually(headerParamContent);
          k6Code += `  const ${headersVariableName} = ${JSON.stringify(headers)};\n`;
        } catch (e) {
          console.error(`Error parsing header file: ${e.message}`);
          k6Code += `  const ${headersVariableName} = {};\n`;
        }
      } else {
        k6Code += `  const ${headersVariableName} = {};\n`;
      }
    } else {
      k6Code += `  const ${headersVariableName} = {};\n`;
    }

    // Handle query parameters
    let params = {};
    if (endpointDetails.queryParams && endpointDetails.queryParams.length > 0) {
      const queryParamFile = `${operationId}_${path.split('/').filter(Boolean).pop()}_path.yaml`;
      const queryParamFilePath = pathModule.join(process.argv[2], 'fitness', queryParamFile);

      if (fsModule.existsSync(queryParamFilePath)) {
        try {
          const queryParamContent = fsModule.readFileSync(queryParamFilePath, 'utf8');
          params = parseYamlManually(queryParamContent);
          k6Code += `  const ${paramsVariableName} = ${JSON.stringify(params)};\n`;
        } catch (e) {
          console.error(`Error parsing query file: ${e.message}`);
          k6Code += `  const ${paramsVariableName} = {};\n`;
        }
      } else {
        k6Code += `  const ${paramsVariableName} = {};\n`;
      }
    } else {
      k6Code += `  const ${paramsVariableName} = {};\n`;
    }

    // Construct k6 request
    k6Code += `  let ${resVariableName} = http.${method}(${urlVariableName}, ${bodyVariableName}, { headers: ${headersVariableName}, params: ${paramsVariableName} });\n`;
    k6Code += `  ${operationId}Trend.add(${resVariableName}.timings.waiting);\n`;
    k6Code += `  check(${resVariableName}, {\n    ${operationId}_status_200_check: (r) => r.status === 200,\n  });\n`;
  }

  k6Code += `}\n`;
  return k6Code;
}

function generateReport(validationReport) {
  console.log('\n====================================');
  console.log('      VALIDATION REPORT');
  console.log('====================================\n');

  if (validationReport.missingServerUrl) {
    console.log('■ Server URL is missing in the Swagger file');
  }

  if (validationReport.missingFiles.length > 0) {
    console.log('\n■ Missing files:');
    validationReport.missingFiles.forEach(item => {
      console.log(`  - ${item.file} (${item.type} parameter for operation: ${item.operationId})`);
    });
  }

  if (validationReport.emptyValues.length > 0) {
    console.log('\n■ Files with empty values:');
    validationReport.emptyValues.forEach(item => {
      console.log(`  - ${item.file} (${item.type} parameter for operation: ${item.operationId})`);
    });
  }

  console.log('\n■ Endpoints validated:');
  Object.entries(validationReport.endpoints).forEach(([operationId, details]) => {
    console.log(`  - ${operationId} (${details.method.toUpperCase()} ${details.path})`);

    if (details.queryParams && details.queryParams.length > 0) {
      console.log(`    Query parameters: ${details.queryParams.join(', ')}`);
    }

    if (details.headerParams && details.headerParams.length > 0) {
      console.log(`    Header parameters: ${details.headerParams.join(', ')}`);
    }

    if (details.issues && details.issues.length > 0) {
      console.log(`    Issues found:`);
      details.issues.forEach(issue => {
        if (issue.missingParameters) {
          console.log(`      * File ${issue.file} is missing parameters: ${issue.missingParameters.join(', ')}`);
        }
        if (issue.emptyParameters) {
          console.log(`      * File ${issue.file} has empty parameters: ${issue.emptyParameters.join(', ')}`);
        }
        if (issue.missingRequiredProperties) {
          console.log(`      * File ${issue.file} is missing required properties: ${issue.missingRequiredProperties.join(', ')}`);
        }
        if (issue.typeValidationErrors) {
          console.log(`      * File ${issue.file} has type validation errors: ${issue.typeValidationErrors.join(', ')}`);
        }
        if (issue.issue) {
          console.log(`      * File ${issue.file}: ${issue.issue}`);
        }
      });
    }
  });

  const hasIssues = validationReport.missingServerUrl ||
    validationReport.missingFiles.length > 0 ||
    validationReport.emptyValues.length > 0 ||
    Object.values(validationReport.endpoints).some(endpoint => endpoint.issues && endpoint.issues.length > 0);

  console.log('\n====================================');
  if (hasIssues) {
    console.log('✘ Validation completed with issues');
  } else {
    console.log('✓ Validation completed successfully');
  }
  console.log('====================================');
}

async function validateSwaggerAndFiles() {
  try {
    const folderPath = process.argv[2];
    if (!folderPath) {
      console.error('Please provide a folder path as an argument');
      process.exit(1);
    }

    console.log(`Checking folder: ${folderPath}`);

    const fitnessPath = path.join(folderPath, 'fitness');

    if (!await directoryExists(fitnessPath)) {
      console.error('Fitness folder does not exist');
      process.exit(1);
    }

    const files = await readdir(fitnessPath);
    console.log('\nFiles in fitness folder:');
    files.forEach(file => console.log(`- ${file}`));

    const swaggerFile = await findSwaggerFile(fitnessPath, files, path); // 2. Call: Pass path
    if (!swaggerFile) {
      console.error('\nNo swagger/openapi file found. Please check fitness folder.');
      process.exit(1);
    }

    console.log(`\nFound Swagger/OpenAPI file: ${swaggerFile}`);

    const swaggerContent = await readFileContent(path.join(fitnessPath, swaggerFile));
    if (!swaggerContent) {
      console.error('Could not read Swagger file content.');
      process.exit(1);
    }

    let swagger;
    try {
      swagger = JSON.parse(swaggerContent);
    } catch (error) {
      console.log("JSON parsing failed, attempting to parse as YAML...");
      console.error('YAML parsing is not supported in this version.');
      console.error('Please convert your Swagger/OpenAPI file to JSON format.');
      console.error('Or install the yaml package: npm install yaml');
      process.exit(1);
    }

    const validationReport = createValidationReport();
    await validateSwagger(swagger, fitnessPath, validationReport, path); // 2. Call: Pass path

    generateReport(validationReport);

    if (validationReport.missingServerUrl || validationReport.missingFiles.length > 0 || validationReport.emptyValues.length > 0) {
      console.warn("Validation failed, k6 script will not be generated.");
    } else {
      const k6Script = generateK6Script(swagger, validationReport, path, fs); // 2. Call: Pass path and fs
      if (k6Script) {
        const k6ScriptPath = path.join(folderPath, 'k6_script.js');
        fs.writeFileSync(k6ScriptPath, k6Script);
        console.log(`\nk6 script generated successfully at: ${k6ScriptPath}`);
      } else {
        console.error("Failed to generate k6 script.");
      }
    }

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

// --- Run the validation ---
validateSwaggerAndFiles();
