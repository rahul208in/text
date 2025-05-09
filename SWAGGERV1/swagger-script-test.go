package main

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"log"
	"os"
	"path/filepath"
	"reflect"
	"regexp"
	"strings"
	"testing"

	"gopkg.in/yaml.v2"
)

// --- Test Constants ---
const (
	testDir          = "test_data"
	testSwaggerFile  = "swagger.json"
	testFitnessDir   = "fitness"
	testDevEnv       = "dev"
	testUatEnv       = "uat"
	testMissingFile  = "missing.yaml"
	testEmptyFile    = "empty.yaml"
	testParamFile    = "params.yaml"
	testBodyFile     = "body.json"
	testSchemaFile   = "schema.json"
	testOperationID  = "testOperation"
	testEndpointPath = "/test"
)

// --- Test Helper Functions ---

func setupTestDir(t *testing.T) {
	err := os.MkdirAll(filepath.Join(testDir, testFitnessDir, testDevEnv), 0755)
	if err != nil {
		t.Fatalf("Failed to create test directory: %v", err)
	}
	err = os.MkdirAll(filepath.Join(testDir, testFitnessDir, testUatEnv), 0755)
	if err != nil {
		t.Fatalf("Failed to create test directory: %v", err)
	}
}

func createTestFile(t *testing.T, filePath string, content string) {
	err := ioutil.WriteFile(filePath, []byte(content), 0644)
	if err != nil {
		t.Fatalf("Failed to create test file: %v", err)
	}
}

func cleanupTestDir(t *testing.T) {
	err := os.RemoveAll(testDir)
	if err != nil {
		t.Fatalf("Failed to cleanup test directory: %v", err)
	}
}

func createTestSwaggerFile(t *testing.T, content string) {
	filePath := filepath.Join(testDir, testFitnessDir, testSwaggerFile)
	createTestFile(t, filePath, content)
}

func createTestFitnessFile(t *testing.T, env string, fileName string, content string) {
	filePath := filepath.Join(testDir, testFitnessDir, env, fileName)
	createTestFile(t, filePath, content)
}

func areEqual(t *testing.T, expected, actual interface{}, message string) {
	if !reflect.DeepEqual(expected, actual) {
		t.Errorf("%s: \nExpected: %v\nActual: %v", message, expected, actual)
	}
}

// --- Test Cases ---

func TestReadFileContent(t *testing.T) {
	setupTestDir(t)
	defer cleanupTestDir(t)

	testFile := filepath.Join(testDir, "test.txt")
	createTestFile(t, testFile, "test content")

	content, err := readFileContent(testFile)
	if err != nil {
		t.Errorf("readFileContent failed: %v", err)
	}
	if content != "test content" {
		t.Errorf("readFileContent returned incorrect content: %s", content)
	}

	_, err = readFileContent("nonexistent.txt")
	if err == nil {
		t.Errorf("readFileContent should have returned an error for nonexistent file")
	}
}

func TestDirectoryExists(t *testing.T) {
	setupTestDir(t)
	defer cleanupTestDir(t)

	if !directoryExists(testDir) {
		t.Errorf("directoryExists failed: %s should exist", testDir)
	}

	if directoryExists("nonexistent") {
		t.Errorf("directoryExists failed: nonexistent should not exist")
	}
}

func TestFileExists(t *testing.T) {
	setupTestDir(t)
	defer cleanupTestDir(t)

	testFile := filepath.Join(testDir, "test.txt")
	createTestFile(t, testFile, "test content")

	if !fileExists(testFile) {
		t.Errorf("fileExists failed: %s should exist", testFile)
	}

	if fileExists("nonexistent.txt") {
		t.Errorf("fileExists failed: nonexistent.txt should not exist")
	}
}

func TestIsSwaggerFileContent(t *testing.T) {
	positiveCases := []string{
		`{"openapi": "3.0.0"}`,
		`{"swagger": "2.0"}`,
		`{'openapi': '3.0.0'}`,
		`{'swagger': '2.0'}`,
	}

	negativeCases := []string{
		`{"notSwagger": "value"}`,
		`just some text`,
	}

	for _, content := range positiveCases {
		if !isSwaggerFileContent(content) {
			t.Errorf("isSwaggerFileContent failed: %s should be recognized as Swagger", content)
		}
	}

	for _, content := range negativeCases {
		if isSwaggerFileContent(content) {
			t.Errorf("isSwaggerFileContent failed: %s should not be recognized as Swagger", content)
		}
	}
}

func TestFindSwaggerFile(t *testing.T) {
	setupTestDir(t)
	defer cleanupTestDir(t)

	createTestSwaggerFile(t, `{"openapi": "3.0.0"}`)

	swaggerFile, err := findSwaggerFile(filepath.Join(testDir, testFitnessDir))
	if err != nil {
		t.Errorf("findSwaggerFile failed: %v", err)
	}
	if swaggerFile != testSwaggerFile {
		t.Errorf("findSwaggerFile returned incorrect file: %s", swaggerFile)
	}

	_, err = findSwaggerFile("nonexistent")
	if err != nil {
		t.Errorf("findSwaggerFile should not return error for nonexistent directory")
	}

	// Test case where no swagger file is found
	emptyDir := filepath.Join(testDir, "empty")
	err = os.MkdirAll(emptyDir, 0755)
	if err != nil {
		t.Fatalf("Failed to create test directory: %v", err)
	}
	swaggerFile, err = findSwaggerFile(emptyDir)
	if err != nil {
		t.Errorf("findSwaggerFile should not return error for empty directory")
	}
	if swaggerFile != "" {
		t.Errorf("findSwaggerFile should return empty string when no swagger file is found")
	}
}

func TestParseYamlManually(t *testing.T) {
	testCases := []struct {
		name     string
		content  string
		expected map[string]string
	}{
		{
			name: "Header Items",
			content: `
---
- name: header1
  value: value1
- name: header2
  value: value2
`,
			expected: map[string]string{"header1": "value1", "header2": "value2"},
		},
		{
			name: "Single Parameter",
			content: `
parameters:
  parameter:
    name: param1
    value: value1
`,
			expected: map[string]string{"param1": "value1"},
		},
		{
			name: "Multiple Parameters",
			content: `
- name: param1
  value: value1
- name: param2
  value: value2
`,
			expected: map[string]string{"param1": "value1", "param2": "value2"},
		},
		{
			name: "Direct Parameters",
			content: `
param1: value1
param2: value2
`,
			expected: map[string]string{"param1": "value1", "param2": "value2"},
		},
		{
			name: "Mixed Parameters",
			content: `
- name: header1
  value: value1
param2: value2
`,
			expected: map[string]string{"header1": "value1", "param2": "value2"},
		},
		{
			name: "Empty Content",
			content:  ``,
			expected: map[string]string{},
		},
		{
			name: "Commented Content",
			content:  `# This is a comment`,
			expected: map[string]string{},
		},
		{
			name: "Complex Content",
			content: `
---
# Comment
- name: param1
  value: value1

param2: value2

parameters:
  parameter:
    name: param3
    value: value3
`,
			expected: map[string]string{"param1": "value1", "param2": "value2", "param3": "value3"},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			actual := parseYamlManually(tc.content)
			areEqual(t, tc.expected, actual, fmt.Sprintf("Test case %s failed", tc.name))
		})
	}
}

func TestCreateValidationReport(t *testing.T) {
	report := createValidationReport()
	if report.MissingServerURL != false {
		t.Errorf("createValidationReport failed: MissingServerURL should be false")
	}
	if report.Endpoints == nil {
		t.Errorf("createValidationReport failed: Endpoints should be initialized")
	}
	if report.MissingFiles == nil {
		t.Errorf("createValidationReport failed: MissingFiles should be initialized")
	}
	if report.EmptyValues == nil {
		t.Errorf("createValidationReport failed: EmptyValues should be initialized")
	}
}

func TestValidateParameterFile(t *testing.T) {
	setupTestDir(t)
	defer cleanupTestDir(t)

	validationReport := createValidationReport()
	params := []map[string]interface{}{
		{"name": "param1"},
		{"name": "param2"},
	}

	// Test case: File not found
	err := validateParameterFile(testMissingFile, params, "query", testOperationID, filepath.Join(testDir, testFitnessDir, testDevEnv), &validationReport)
	if err != nil {
		t.Errorf("validateParameterFile failed: %v", err)
	}
	if len(validationReport.MissingFiles) != 1 {
		t.Errorf("validateParameterFile failed: MissingFiles should have 1 entry")
	}

	// Test case: Empty file
	createTestFitnessFile(t, testDevEnv, testEmptyFile, "")
	err = validateParameterFile(testEmptyFile, params, "query", testOperationID, filepath.Join(testDir, testFitnessDir, testDevEnv), &validationReport)
	if err != nil {
		t.Errorf("validateParameterFile failed: %v", err)
	}
	if len(validationReport.EmptyValues) != 1 {
		t.Errorf("validateParameterFile failed: EmptyValues should have 1 entry")
	}

	// Test case: Valid file with missing parameters
	createTestFitnessFile(t, testDevEnv, testParamFile, "param1: value1")
	err = validateParameterFile(testParamFile, params, "query", testOperationID, filepath.Join(testDir, testFitnessDir, testDevEnv), &validationReport)
	if err != nil {
		t.Errorf("validateParameterFile failed: %v", err)
	}
	if len(validationReport.Endpoints[testOperationID].Issues) != 1 {
		t.Errorf("validateParameterFile failed: Issues should have 1 entry")
	}

	// Test case: Valid file with empty parameters
	createTestFitnessFile(t, testDevEnv, testParamFile, "param1: value1\nparam2:")
	err = validateParameterFile(testParamFile, params, "query", testOperationID, filepath.Join(testDir, testFitnessDir, testDevEnv), &validationReport)
	if err != nil {
		t.Errorf("validateParameterFile failed: %v", err)
	}
	if len(validationReport.Endpoints[testOperationID].Issues) != 1 {
		t.Errorf("validateParameterFile failed: Issues should have 1 entry")
	}

	// Test case: Valid file with all parameters
	createTestFitnessFile(t, testDevEnv, testParamFile, "param1: value1\nparam2: value2")
	err = validateParameterFile(testParamFile, params, "query", testOperationID, filepath.Join(testDir, testFitnessDir, testDevEnv), &validationReport)
	if err != nil {
		t.Errorf("validateParameterFile failed: %v", err)
	}
	if len(validationReport.Endpoints[testOperationID].Issues) != 0 {
		t.Errorf("validateParameterFile failed: Issues should have 0 entry")
	}
}

func TestValidateBodyFile(t *testing.T) {
	setupTestDir(t)
	defer cleanupTestDir(t)

	validationReport := createValidationReport()

	// Test case: File not found
	err := validateBodyFile(testMissingFile, testOperationID, filepath.Join(testDir, testFitnessDir, testDevEnv), &validationReport)
	if err != nil {
		t.Errorf("validateBodyFile failed: %v", err)
	}
	if len(validationReport.MissingFiles) != 1 {
		t.Errorf("validateBodyFile failed: MissingFiles should have 1 entry")
	}

	// Test case: Empty file
	createTestFitnessFile(t, testDevEnv, testEmptyFile, "")
	err = validateBodyFile(testEmptyFile, testOperationID, filepath.Join(testDir, testFitnessDir, testDevEnv), &validationReport)
	if err != nil {
		t.Errorf("validateBodyFile failed: %v", err)
	}
	if len(validationReport.EmptyValues) != 1 {
		t.Errorf("validateBodyFile failed: EmptyValues should have 1 entry")
	}

	// Test case: Valid file
	createTestFitnessFile(t, testDevEnv, testBodyFile, `{"key": "value"}`)
	err = validateBodyFile(testBodyFile, testOperationID, filepath.Join(testDir, testFitnessDir, testDevEnv), &validationReport)
	if err != nil {
		t.Errorf("validateBodyFile failed: %v", err)
	}
	if len(validationReport.Endpoints) == 0 {
		t.Errorf("validateBodyFile failed: Endpoints should have 1 entry")
	}
	if validationReport.Endpoints[testOperationID].BodyFile != testBodyFile {
		t.Errorf("validateBodyFile failed: BodyFile should be %s", testBodyFile)
	}
}

func TestValidateSchemaRef(t *testing.T) {
	setupTestDir(t)
	defer cleanupTestDir(t)

	validationReport := createValidationReport()
	swaggerContent := `
{
  "components": {
    "schemas": {
      "TestSchema": {}
    }
  }
}
`
	var swagger map[string]interface{}
	err := json.Unmarshal([]byte(swaggerContent), &swagger)
	if err != nil {
		t.Fatalf("Failed to unmarshal swagger content: %v", err)
	}

	// Test case: File not found
	err = validateSchemaRef("#/components/schemas/TestSchema", testOperationID, swagger, filepath.Join(testDir, testFitnessDir, testDevEnv), &validationReport)
	if err != nil {
		t.Errorf("validateSchemaRef failed: %v", err)
	}
	if len(validationReport.MissingFiles) != 0 {
		t.Errorf("validateSchemaRef failed: MissingFiles should have 0 entry")
	}

	// Test case: Empty file
	createTestFitnessFile(t, testDevEnv, "TestSchema.json", "")
	err = validateSchemaRef("#/components/schemas/TestSchema", testOperationID, swagger, filepath.Join(testDir, testFitnessDir, testDevEnv), &validationReport)
	if err != nil {
		t.Errorf("validateSchemaRef failed: %v", err)
	}
	if len(validationReport.EmptyValues) != 0 {
		t.Errorf("validateSchemaRef failed: EmptyValues should have 0 entry")
	}

	// Test case: Valid file
	createTestFitnessFile(t, testDevEnv, "TestSchema.json", `{"key": "value"}`)
	err = validateSchemaRef("#/components/schemas/TestSchema", testOperationID, swagger, filepath.Join(testDir, testFitnessDir, testDevEnv), &validationReport)
	if err != nil {
		t.Errorf("validateSchemaRef failed: %v", err)
	}
}

func TestValidateRequestBody(t *testing.T) {
	setupTestDir(t)
	defer cleanupTestDir(t)

	validationReport := createValidationReport()
	swaggerContent := `
{
  "components": {
    "schemas": {
      "TestSchema": {}
    }
  }
}
`
	var swagger map[string]interface{}
	err := json.Unmarshal([]byte(swaggerContent), &swagger)
	if err != nil {
		t.Fatalf("Failed to unmarshal swagger content: %v", err)
	}

	// Test case: application/json with $ref
	requestBody := map[string]interface{}{
		"content": map[string]interface{}{
			"application/json": map[string]interface{}{
				"schema": map[string]interface{}{
					"$ref": "#/components/schemas/TestSchema",
				},
			},
		},
	}
	err = validateRequestBody(requestBody, testOperationID, testEndpointPath, swagger, filepath.Join(testDir, testFitnessDir, testDevEnv), &validationReport)
	if err != nil {
		t.Errorf("validateRequestBody failed: %v", err)
	}

	// Test case: multipart/form-data
	requestBody = map[string]interface{}{
		"content": map[string]interface{}{
			"multipart/form-data": map[string]interface{}{
				"schema": map[string]interface{}{
					"required": []interface{}{"field1"},
				},
			},
		},
	}
	err = validateRequestBody(requestBody, testOperationID, testEndpointPath, swagger, filepath.Join(testDir, testFitnessDir, testDevEnv), &validationReport)
	if err != nil {
		t.Errorf("validateRequestBody failed: %v", err)
	}
}

func TestValidateParameters(t *testing.T) {
	setupTestDir(t)
	defer cleanupTestDir(t)

	validationReport := createValidationReport()
	parameters := []interface{}{
		map[string]interface{}{
			"name": "queryParam",
			"in":   "query",
		},
		map[string]interface{}{
			"name": "headerParam",
			"in":   "header",
		},
	}

	err := validateParameters(parameters, testOperationID, testEndpointPath, filepath.Join(testDir, testFitnessDir, testDevEnv), &validationReport)
	if err != nil {
		t.Errorf("validateParameters failed: %v", err)
	}
	if len(validationReport.Endpoints) == 0 {
		t.Errorf("validateParameters failed: Endpoints should have 1 entry")
	}
	if len(validationReport.Endpoints[testOperationID].QueryParams) != 1 {
		t.Errorf("validateParameters failed: QueryParams should have 1 entry")
	}
	if len(validationReport.Endpoints[testOperationID].HeaderParams) != 1 {
		t.Errorf("validateParameters failed: HeaderParams should have 1 entry")
	}
}

func TestValidateSwagger(t *testing.T) {
	setupTestDir(t)
	defer cleanupTestDir(t)

	validationReport := createValidationReport()
	swaggerContent := `
{
  "openapi": "3.0.0",
  "servers": [
    {
      "url": "http://example.com"
    }
  ],
  "paths": {
    "/test": {
      "get": {
        "operationId": "testOperation",
        "parameters": [
          {
            "name": "queryParam",
            "in": "query"
          }
        ]
      }
    }
  }
}
`
	var swagger map[string]interface{}
	err := json.Unmarshal([]byte(swaggerContent), &swagger)
	if err != nil {
		t.Fatalf("Failed to unmarshal swagger content: %v", err)
	}

	err = validateSwagger(swagger, filepath.Join(testDir, testFitnessDir, testDevEnv), &validationReport)
	if err != nil {
		t.Errorf("validateSwagger failed: %v", err)
	}
	if validationReport.MissingServerURL {
		t.Errorf("validateSwagger failed: MissingServerURL should be false")
	}
	if len(validationReport.Endpoints) == 0 {
		t.Errorf("validateSwagger failed: Endpoints should have 1 entry")
	}
}

func TestGenerateK6Script(t *testing.T) {
	setupTestDir(t)
	defer cleanupTestDir(t)

	swaggerContent := `
{
  "openapi": "3.0.0",
  "servers": [
    {
      "url": "http://example.com"
    }
  ],
  "paths": {
    "/test": {
      "get": {
        "operationId": "testOperation",
        "parameters": [
          {
            "name": "queryParam",
            "in": "query"
          }
        ]
      }
    }
  }
}
`
	var swagger map[string]interface{}
	err := json.Unmarshal([]byte(swaggerContent), &swagger)
	if err != nil {
		t.Fatalf("Failed to unmarshal swagger content: %v", err)
	}

	validationReport := createValidationReport()
	err = validateSwagger(swagger, filepath.Join(testDir, testFitnessDir, testDevEnv), &validationReport)
	if err != nil {
		t.Errorf("validateSwagger failed: %v", err)
	}

	k6Script, err := generateK6Script(swagger, validationReport, testDevEnv)
	if err != nil {
		t.Errorf("generateK6Script failed: %v", err)
	}
	if k6Script == "" {
		t.Errorf("generateK6Script returned empty script")
	}
}

func TestDetectEnvironmentFolders(t *testing.T) {
	setupTestDir(t)
	defer cleanupTestDir(t)

	// Create environment folders
	os.MkdirAll(filepath.Join(testDir, testFitnessDir, "dev"), 0755)
	os.MkdirAll(filepath.Join(testDir, testFitnessDir, "uat"), 0755)
	os.MkdirAll(filepath.Join(testDir, testFitnessDir, "gt-dev"), 0755)
	os.MkdirAll(filepath.Join(testDir, testFitnessDir, "gt-uat"), 0755)
	os.MkdirAll(filepath.Join(testDir, testFitnessDir, "sw-dev"), 0755)
	os.MkdirAll(filepath.Join(testDir, testFitnessDir, "sw-uat"), 0755)

	// Detect environment folders
	environmentFolders := detectEnvironmentFolders(filepath.Join(testDir, testFitnessDir))

	// Expected environment folders
	expectedEnvironmentFolders := []string{"dev", "uat", "gt-dev", "gt-uat", "sw-dev", "sw-uat"}

	// Check if the detected environment folders match the expected environment folders
	if !reflect.DeepEqual(environmentFolders, expectedEnvironmentFolders) {
		t.Errorf("detectEnvironmentFolders failed: expected %v, got %v", expectedEnvironmentFolders, environmentFolders)
	}
}

func TestValidateSwaggerAndFiles(t *testing.T) {
	setupTestDir(t)
	defer cleanupTestDir(t)

	// Create test swagger file
	swaggerContent := `
{
  "openapi": "3.0.0",
  "servers": [
    {
      "url": "http://example.com"
    }
  ],
  "paths": {
    "/test": {
      "get": {
        "operationId": "testOperation",
        "parameters": [
          {
            "name": "queryParam",
            "in": "query"
          }
        ]
      }
    }
  }
}
`
	createTestSwaggerFile(t, swaggerContent)

	// Create test environment folders
	os.MkdirAll(filepath.Join(testDir, testFitnessDir, "dev"), 0755)
	os.MkdirAll(filepath.Join(testDir, testFitnessDir, "uat"), 0755)

	// Create test parameter file
	createTestFitnessFile(t, "dev", "testOperation_/test_path.yaml", "queryParam: value")
	createTestFitnessFile(t, "uat", "testOperation_/test_path.yaml", "queryParam: value")

	// Set command line arguments
	os.Args = []string{"main.go", testDir}

	// Call validateSwaggerAndFiles
	err := validateSwaggerAndFiles()
	if err != nil {
		t.Errorf("validateSwaggerAndFiles failed: %v", err)
	}

	// Check if k6 script is generated
	k6ScriptFileDev := filepath.Join(testDir, "vpe-default-k6-swagger_dev.js")
	k6ScriptFileUat := filepath.Join(testDir, "vpe-default-k6-swagger_uat.js")
	if !fileExists(k6ScriptFileDev) {
		t.Errorf("validateSwaggerAndFiles failed: k6 script for dev environment not generated")
	}
	if !fileExists(k6ScriptFileUat) {
		t.Errorf("validateSwaggerAndFiles failed: k6 script for uat environment not generated")
	}

	// Check if .env_vars file is created
	envVarsFile := filepath.Join(testDir, ".env_vars")
	if !fileExists(envVarsFile) {
		t.Errorf("validateSwaggerAndFiles failed: .env_vars file not created")
	}
}

func TestMain(m *testing.M) {
	// Set log flags for testing
	log.SetFlags(log.LstdFlags | log.Lshortfile)

	// Run tests
	exitCode := m.Run()

	// Exit with the appropriate code
	os.Exit(exitCode)
}
