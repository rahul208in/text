package main

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"log"
	"os"
	"path/filepath"
	"regexp"
	"strings"

	"gopkg.in/yaml.v2"
)

// --- Constants ---
var swaggerIndicators = []string{
	`"openapi":`,
	`"swagger":`,
	`'openapi':`,
	`'swagger':`,
}

// --- Types ---

type ValidationReport struct {
	MissingServerURL bool                   `json:"missingServerUrl"`
	Endpoints        map[string]EndpointDetails `json:"endpoints"`
	MissingFiles     []MissingFile          `json:"missingFiles"`
	EmptyValues      []EmptyValue           `json:"emptyValues"`
}

type EndpointDetails struct {
	Path        string      `json:"path"`
	Method      string      `json:"method"`
	QueryParams []string    `json:"queryParams"`
	HeaderParams  []string    `json:"headerParams"`
	BodyContent interface{} `json:"bodyContent"`
	BodyFile    string      `json:"bodyFile,omitempty"`
	Issues      []Issue     `json:"issues"`
}

type MissingFile struct {
	File        string `json:"file"`
	Type        string `json:"type"`
	OperationID string `json:"operationId"`
}

type EmptyValue struct {
	File        string `json:"file"`
	Type        string `json:"type"`
	OperationID string `json:"operationId"`
	Issue       string `json:"issue,omitempty"`
}

type Issue struct {
	File                  string   `json:"file"`
	MissingParameters     []string `json:"missingParameters,omitempty"`
	EmptyParameters       []string `json:"emptyParameters,omitempty"`
	MissingRequiredProperties []string `json:"missingRequiredProperties,omitempty"`
	TypeValidationErrors  []string `json:"typeValidationErrors,omitempty"`
	Issue                 string   `json:"issue,omitempty"`
}

// --- Helper Functions ---

func readFileContent(filePath string) (string, error) {
	content, err := ioutil.ReadFile(filePath)
	if err != nil {
		return "", fmt.Errorf("error reading file %s: %w", filePath, err)
	}
	return string(content), nil
}

func directoryExists(dirPath string) bool {
	_, err := os.Stat(dirPath)
	if err != nil {
		if os.IsNotExist(err) {
			return false
		}
		return false // Or handle other errors as needed
	}
	fileInfo, err := os.Stat(dirPath)
	if err != nil {
		return false
	}
	return fileInfo.IsDir()
}

func fileExists(filePath string) bool {
	_, err := os.Stat(filePath)
	return !os.IsNotExist(err)
}

func isSwaggerFileContent(content string) bool {
	firstPortion := content
	if len(content) > 1000 {
		firstPortion = content[:1000]
	}
	for _, indicator := range swaggerIndicators {
		if strings.Contains(firstPortion, indicator) {
			return true
		}
	}
	return false
}

func findSwaggerFile(dirPath string) (string, error) {
	files, err := ioutil.ReadDir(dirPath)
	if err != nil {
		return "", err
	}

	for _, file := range files {
		if file.IsDir() {
			fmt.Println("Skipping directory:", file.Name())
			continue
		}

		filePath := filepath.Join(dirPath, file.Name())
		fmt.Println("Checking file:", file.Name())

		content, err := readFileContent(filePath)
		if err != nil {
			fmt.Println("Error reading file:", file.Name(), err)
			continue
		}

		if isSwaggerFileContent(content) {
			return file.Name(), nil
		}
	}

	return "", nil
}

func parseYamlManually(content string) map[string]string {
	result := make(map[string]string)
	content = strings.Replace(content, "---", "", 1)

	// Regex to find header items
	headerItemsRegex := regexp.MustCompile(`-\s*name:\s*["']?([^"'\r\n]+)["']?[\r\n\s]*value:\s*["']?([^"'\r\n]*)["']?`)
	headerMatches := headerItemsRegex.FindAllStringSubmatch(content, -1)

	if len(headerMatches) > 0 {
		for _, match := range headerMatches {
			name := strings.TrimSpace(match[1])
			value := strings.TrimSpace(match[2])
			result[name] = value
			fmt.Printf("    Found header parameter: %s = %s\n", name, value)
		}
		return result
	}

	// Regex to find single parameter
	singleParamRegex := regexp.MustCompile(`parameters:[\r\n\s]*parameter:[\r\n\s]*name:\s*["']?([^"'\r\n]+)["']?[\r\n\s]*value:\s*["']?([^"'\r\n]*)["']?`)
	singleParamMatch := singleParamRegex.FindStringSubmatch(content)

	if len(singleParamMatch) > 0 {
		name := strings.TrimSpace(singleParamMatch[1])
		value := strings.TrimSpace(singleParamMatch[2])
		result[name] = value
		fmt.Printf("    Found single parameter: %s = %s\n", name, value)
		return result
	}

	// Regex to find multiple parameters
	multiParamRegex := regexp.MustCompile(`-\s*name:\s*["']?([^"'\r\n]+)["']?[\r\n\s]*value:\s*["']?([^"'\r\n]*)["']?`)
	multiParamMatches := multiParamRegex.FindAllStringSubmatch(content, -1)

	if len(multiParamMatches) > 0 {
		for _, match := range multiParamMatches {
			name := strings.TrimSpace(match[1])
			value := strings.TrimSpace(match[2])
			result[name] = value
			fmt.Printf("    Found parameter: %s = %s\n", name, value)
		}
		return result
	}

	// Split content into lines and process each line
	lines := strings.Split(content, "\n")
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}

		colonIndex := strings.Index(line, ":")
		if colonIndex > 0 {
			key := strings.TrimSpace(line[:colonIndex])
			value := strings.TrimSpace(line[colonIndex+1:])
			value = strings.Trim(value, `"'`)
			result[key] = value
			fmt.Printf("    Found direct parameter: %s = %s\n", key, value)
		}
	}

	return result
}

/**
 * @returns {ValidationReport}
 */
func createValidationReport() ValidationReport {
	return ValidationReport{
		MissingServerURL: false,
		Endpoints:        make(map[string]EndpointDetails),
		MissingFiles:     []MissingFile{},
		EmptyValues:      []EmptyValue{},
	}
}
// Part 2: Validation Functions

func validateParameterFile(fileName string, params []map[string]interface{}, paramType string, operationID string, fitnessPath string, validationReport *ValidationReport) error {
	filePath := filepath.Join(fitnessPath, fileName)
	paramNames := make([]string, 0, len(params))
	for _, p := range params {
		if name, ok := p["name"].(string); ok {
			paramNames = append(paramNames, name)
		}
	}

	if _, err := os.Stat(filePath); os.IsNotExist(err) {
		fmt.Printf("    Warning: %s parameter file %s not found\n", paramType, fileName)
		validationReport.MissingFiles = append(validationReport.MissingFiles, MissingFile{
			File:        fileName,
			Type:        paramType,
			OperationID: operationID,
		})
		return nil
	}

	fmt.Printf("    Found %s parameter file: %s\n", paramType, fileName)
	content, err := readFileContent(filePath)
	if err != nil {
		return err
	}

	if strings.TrimSpace(content) == "" {
		fmt.Printf("    Warning: %s is empty\n", fileName)
		validationReport.EmptyValues = append(validationReport.EmptyValues, EmptyValue{
			File:        fileName,
			Type:        paramType,
			OperationID: operationID,
		})
		return nil
	}

	fmt.Println("    ", paramType, "parameter file has content")

	paramValues := parseYamlManually(content)

	if len(paramValues) == 0 {
		fmt.Printf("    Warning: Unable to parse content of %s or no parameters found\n", fileName)
		validationReport.EmptyValues = append(validationReport.EmptyValues, EmptyValue{
			File:        fileName,
			Type:        paramType,
			OperationID: operationID,
			Issue:       "Cannot parse content or no parameters found",
		})
		return nil
	}

	missingParams := []string{}
	emptyParams := []string{}

	for _, paramName := range paramNames {
		if _, ok := paramValues[paramName]; !ok {
			missingParams = append(missingParams, paramName)
		} else if paramValues[paramName] == "" {
			emptyParams = append(emptyParams, paramName)
		} else {
			fmt.Printf("    ✓ Parameter '%s' is present and has value: %s\n", paramName, paramValues[paramName])
		}
	}

	if len(missingParams) > 0 {
		fmt.Printf("    Warning: Parameters missing in %s: %s\n", fileName, strings.Join(missingParams, ", "))
		endpointDetails := validationReport.Endpoints[operationID]
		endpointDetails.Issues = append(endpointDetails.Issues, Issue{
			File:              fileName,
			MissingParameters: missingParams,
		})
		validationReport.Endpoints[operationID] = endpointDetails
	}

	if len(emptyParams) > 0 {
		fmt.Printf("    Warning: Empty parameters in %s: %s\n", fileName, strings.Join(emptyParams, ", "))
		endpointDetails := validationReport.Endpoints[operationID]
		endpointDetails.Issues = append(endpointDetails.Issues, Issue{
			File:            fileName,
			EmptyParameters: emptyParams,
		})
		validationReport.Endpoints[operationID] = endpointDetails
	}
	return nil
}

func validateBodyFile(fileName string, operationID string, fitnessPath string, validationReport *ValidationReport) error {
	filePath := filepath.Join(fitnessPath, fileName)

	if _, err := os.Stat(filePath); os.IsNotExist(err) {
		fmt.Printf("    Warning: Body file %s not found\n", fileName)
		validationReport.MissingFiles = append(validationReport.MissingFiles, MissingFile{
			File:        fileName,
			Type:        "body",
			OperationID: operationID,
		})
		return nil
	}

	fmt.Printf("    Found body file: %s\n", fileName)
	content, err := readFileContent(filePath)
	if err != nil {
		return err
	}

	if strings.TrimSpace(content) == "" {
		fmt.Printf("    Warning: %s is empty\n", fileName)
		validationReport.EmptyValues = append(validationReport.EmptyValues, EmptyValue{
			File:        fileName,
			Type:        "body",
			OperationID: operationID,
		})
		return nil
	}

	fmt.Println("    ✓ Body file has content - validated successfully")

	// Store the body file name in the validationReport
	if _, ok := validationReport.Endpoints[operationID]; ok {
		endpointDetails := validationReport.Endpoints[operationID]
		endpointDetails.BodyFile = fileName
		validationReport.Endpoints[operationID] = endpointDetails
	} else {
		fmt.Printf("Warning: operationID %s not found in validationReport.Endpoints\n", operationID)
	}
	return nil
}

func validateSchemaRef(refPath string, operationID string, swagger map[string]interface{}, fitnessPath string, validationReport *ValidationReport) error {
	schemaName := filepath.Base(refPath)
	fmt.Printf("    Referenced schema: %s\n", schemaName)

	components, ok := swagger["components"].(map[string]interface{})
	if !ok {
		return nil
	}

	schemas, ok := components["schemas"].(map[string]interface{})
	if !ok {
		return nil
	}

	if _, ok := schemas[schemaName]; ok {
		schemaFileName := schemaName + ".json"
		schemaFilePath := filepath.Join(fitnessPath, schemaFileName)

		if _, err := os.Stat(schemaFilePath); os.IsNotExist(err) {
			fmt.Printf("    Warning: Schema file %s not found\n", schemaFileName)
			validationReport.MissingFiles = append(validationReport.MissingFiles, MissingFile{
				File:        schemaFileName,
				Type:        "body",
				OperationID: operationID,
			})
			return nil
		}

		fmt.Printf("    Found schema file: %s\n", schemaFileName)
		content, err := readFileContent(schemaFilePath)
		if err != nil {
			return err
		}

		if strings.TrimSpace(content) == "" {
			fmt.Printf("    Warning: %s is empty\n", schemaFileName)
			validationReport.EmptyValues = append(validationReport.EmptyValues, EmptyValue{
				File:        schemaFileName,
				Type:        "body",
				OperationID: operationID,
			})
			return nil
		}

		fmt.Println("    ✓ Schema file has content - validated successfully")
	}
	return nil
}

func validateRequestBody(requestBody map[string]interface{}, operationID string, endpoint string, swagger map[string]interface{}, fitnessPath string, validationReport *ValidationReport) error {
	if requestBody == nil {
		return nil
	}

	content, ok := requestBody["content"].(map[string]interface{})
	if !ok {
		return nil
	}

	if applicationJSON, ok := content["application/json"].(map[string]interface{}); ok {
		fmt.Println("  - Request body: application/json")
		schema, ok := applicationJSON["schema"].(map[string]interface{})
		if !ok {
			return nil
		}

		if schemaType, ok := schema["type"].(string); ok && schemaType == "array" {
			items, ok := schema["items"].(map[string]interface{})
			if !ok {
				return nil
			}
			ref, ok := items["$ref"].(string)
			if ok {
				schemaName := filepath.Base(ref)
				fmt.Printf("    Referenced schema: %s\n", schemaName)
				schemaFileName := schemaName + ".json"
				return validateBodyFile(schemaFileName, operationID, fitnessPath, validationReport)
			}
		} else if ref, ok := schema["$ref"].(string); ok {
			schemaName := filepath.Base(ref)
			fmt.Printf("    Referenced schema: %s\n", schemaName)
			schemaFileName := schemaName + ".json"
			return validateBodyFile(schemaFileName, operationID, fitnessPath, validationReport)
		}
	} else if multipartFormData, ok := content["multipart/form-data"].(map[string]interface{}); ok {
		fmt.Println("  - Request body: multipart/form-data")
		schema, ok := multipartFormData["schema"].(map[string]interface{})
		if !ok {
			return nil
		}
		required, ok := schema["required"].([]interface{})
		if !ok {
			return nil
		}

		for _, field := range required {
			requiredField, ok := field.(string)
			if !ok {
				continue
			}
			fmt.Printf("    Required field: %s\n", requiredField)
			fileName := requiredField + ".json"
			return validateBodyFile(fileName, operationID, fitnessPath, validationReport)
		}
	}
	return nil
}

func validateParameters(parameters []interface{}, operationID string, endpoint string, fitnessPath string, validationReport *ValidationReport) error {
	queryParams := []map[string]interface{}{}
	headerParams := []map[string]interface{}{}

	for _, param := range parameters {
		if p, ok := param.(map[string]interface{}); ok {
			in, ok := p["in"].(string)
			if !ok {
				continue
			}
			switch in {
			case "query":
				queryParams = append(queryParams, p)
			case "header":
				headerParams = append(headerParams, p)
			}
		}
	}

	endpointLastPart := filepath.Base(endpoint)

	if len(queryParams) > 0 {
		queryParamNames := make([]string, 0, len(queryParams))
		for _, p := range queryParams {
			if name, ok := p["name"].(string); ok {
				queryParamNames = append(queryParamNames, name)
			}
		}
		fmt.Println("  - Query parameters:", strings.Join(queryParamNames, ", "))
		endpointDetails := validationReport.Endpoints[operationID]
		endpointDetails.QueryParams = queryParamNames
		validationReport.Endpoints[operationID] = endpointDetails
		queryParamFileName := fmt.Sprintf("%s_%s_path.yaml", operationID, endpointLastPart)
		if err := validateParameterFile(queryParamFileName, queryParams, "query", operationID, fitnessPath, validationReport); err != nil {
			return err
		}
	}

	if len(headerParams) > 0 {
		headerParamNames := make([]string, 0, len(headerParams))
		for _, p := range headerParams {
			if name, ok := p["name"].(string); ok {
				headerParamNames = append(headerParamNames, name)
			}
		}
		fmt.Println("  - Header parameters:", strings.Join(headerParamNames, ", "))
		endpointDetails := validationReport.Endpoints[operationID]
		endpointDetails.HeaderParams = headerParamNames
		validationReport.Endpoints[operationID] = endpointDetails
		headerParamFileName := fmt.Sprintf("%s_%s_header.yaml", operationID, endpointLastPart)
		if err := validateParameterFile(headerParamFileName, headerParams, "header", operationID, fitnessPath, validationReport); err != nil {
			return err
		}
	}
	return nil
}
// Part 3: validateSwagger Function

func validateSwagger(swagger map[string]interface{}, fitnessPath string, validationReport *ValidationReport) error {
	servers, ok := swagger["servers"].([]interface{})
	if !ok || len(servers) == 0 {
		validationReport.MissingServerURL = true
		fmt.Println("Warning: Missing server URL in Swagger file")
	} else {
		serverMap, ok := servers[0].(map[string]interface{})
		if !ok {
			validationReport.MissingServerURL = true
			fmt.Println("Warning: Missing server URL in Swagger file")
		}
		_, ok = serverMap["url"].(string)
		if !ok {
			validationReport.MissingServerURL = true
			fmt.Println("Warning: Missing server URL in Swagger file")
		}
	}

	paths, ok := swagger["paths"].(map[string]interface{})
	if !ok {
		return nil
	}

	for endpoint, pathItem := range paths {
		fmt.Println("\nValidating endpoint:", endpoint)

		pathItemMap, ok := pathItem.(map[string]interface{})
		if !ok {
			continue
		}

		for method, operation := range pathItemMap {
			operationMap, ok := operation.(map[string]interface{})
			if !ok {
				continue
			}

			operationID, ok := operationMap["operationId"].(string)
			if !ok {
				fmt.Printf("Warning: Missing operationId for %s %s\n", strings.ToUpper(method), endpoint)
				continue
			}

			fmt.Println("- Operation ID:", operationID)
			validationReport.Endpoints[operationID] = EndpointDetails{
				Path:        endpoint,
				Method:      method,
				QueryParams: []string{},
				HeaderParams:  []string{},
				BodyContent: nil,
				Issues:      []Issue{},
			}

			parameters, ok := operationMap["parameters"].([]interface{})
			if ok {
				if err := validateParameters(parameters, operationID, endpoint, fitnessPath, validationReport); err != nil {
					return err
				}
			}

			requestBody, ok := operationMap["requestBody"].(map[string]interface{})
			if ok {
				if err := validateRequestBody(requestBody, operationID, endpoint, swagger, fitnessPath, validationReport); err != nil {
					return err
				}
			}
		}
	}
	return nil
}
// Part 4: generateK6Script Function

func generateK6Script(swagger map[string]interface{}, validationReport ValidationReport, environment string) (string, error) {
	if validationReport.MissingServerURL {
		return "", fmt.Errorf("cannot generate k6 script: Missing server URL in Swagger file")
	}

	servers, ok := swagger["servers"].([]interface{})
	if !ok || len(servers) == 0 {
		return "", fmt.Errorf("cannot generate k6 script: Missing server URL in Swagger file")
	}
	serverMap, ok := servers[0].(map[string]interface{})
	if !ok {
		return "", fmt.Errorf("cannot generate k6 script: Missing server URL in Swagger file")
	}
	baseURL, ok := serverMap["url"].(string)
	if !ok {
		return "", fmt.Errorf("cannot generate k6 script: Missing server URL in Swagger file")
	}

	k6Code := `import http from 'k6/http';
import { check, Trend } from 'k6';

export const options = {
  vus: 10,
  duration: '10s',
};

`

	// Add Trend metrics
	for operationID := range validationReport.Endpoints {
		k6Code += fmt.Sprintf("const %sTrend = new Trend('%s');\n", operationID, operationID)
	}

	k6Code += `
export default function () {
`

	for operationID, endpointDetails := range validationReport.Endpoints {
		path := endpointDetails.Path
		method := endpointDetails.Method

		// Construct URL
		urlVariableName := fmt.Sprintf("%s_url", operationID)
		bodyVariableName := fmt.Sprintf("%s_body", operationID)
		headersVariableName := fmt.Sprintf("%s_headers", operationID)
		paramsVariableName := fmt.Sprintf("%s_params", operationID)
		resVariableName := fmt.Sprintf("%s_res", operationID)

		k6Code += fmt.Sprintf("\n  // %s: %s %s\n", operationID, strings.ToUpper(method), path)

		// Construct URL
		k6Code += fmt.Sprintf("  const %s = '%s%s';\n", urlVariableName, baseURL, path)

		// Handle body
		bodyContent := "null"
		bodyFile := endpointDetails.BodyFile

		var bodyFilePath string
		if bodyFile != "" {
			folderPath := os.Args[1] // Corrected this line
			bodyFilePath = filepath.Join(folderPath, "fitness", environment, bodyFile)
		}

		if fileExists(bodyFilePath) {
			fileContent, err := readFileContent(bodyFilePath)
			if err != nil {
				log.Printf("Error reading body file %s: %v", bodyFile, err)
				bodyContent = "null"
				k6Code += fmt.Sprintf("  const %s = null;\n", bodyVariableName)
			} else {
				bodyContent = fileContent
				// Escape newlines
				bodyContent = strings.ReplaceAll(bodyContent, "\n", "\\n")
				bodyContent = strings.ReplaceAll(bodyContent, "\r", "\\r")

				// Try to parse as JSON, if it fails, treat it as a string
				if json.Valid([]byte(bodyContent)) {
					k6Code += fmt.Sprintf("  const %s = %s;\n", bodyVariableName, bodyContent) // If valid JSON, use directly
				} else {
					// If not valid JSON, treat as a string
					k6Code += fmt.Sprintf("  const %s = `%s`;\n", bodyVariableName, bodyContent) // Use template literals for strings
				}
			}
		} else {
			k6Code += fmt.Sprintf("  const %s = null;\n", bodyVariableName)
		}

		// Handle headers
		headers := make(map[string]string)
		if len(endpointDetails.HeaderParams) > 0 {
			endpointLastPart := filepath.Base(path)
			headerParamFile := fmt.Sprintf("%s_%s_header.yaml", operationID, endpointLastPart)
			folderPath := os.Args[1] // Corrected this line
			headerParamFilePath := filepath.Join(folderPath, "fitness", environment, headerParamFile)

			if fileExists(headerParamFilePath) {
				headerParamContent, err := readFileContent(headerParamFilePath)
				if err != nil {
					log.Printf("Error parsing header file: %v", err)
					k6Code += fmt.Sprintf("  const %s = {};\n", headersVariableName)
				} else {
					headers = parseYamlManually(headerParamContent)
					headersJSON, err := json.Marshal(headers)
					if err != nil {
						log.Printf("Error marshaling headers to JSON: %v", err)
						k6Code += fmt.Sprintf("  const %s = {};\n", headersVariableName)
					} else {
						k6Code += fmt.Sprintf("  const %s = %s;\n", headersVariableName, string(headersJSON))
					}
				}
			} else {
				k6Code += fmt.Sprintf("  const %s = {};\n", headersVariableName)
			}
		} else {
			k6Code += fmt.Sprintf("  const %s = {};\n", headersVariableName)
		}

		// Handle query parameters
		params := make(map[string]string)
		if len(endpointDetails.QueryParams) > 0 {
			endpointLastPart := filepath.Base(path)
			queryParamFile := fmt.Sprintf("%s_%s_path.yaml", operationID, endpointLastPart)
			folderPath := os.Args[1] // Corrected this line
			queryParamFilePath := filepath.Join(folderPath, "fitness", environment, queryParamFile)

			if fileExists(queryParamFilePath) {
				queryParamContent, err := readFileContent(queryParamFilePath)
				if err != nil {
					log.Printf("Error parsing query file: %v", err)
					k6Code += fmt.Sprintf("  const %s = {};\n", paramsVariableName)
				} else {
					params = parseYamlManually(queryParamContent)
					paramsJSON, err := json.Marshal(params)
					if err != nil {
						log.Printf("Error marshaling params to JSON: %v", err)
						k6Code += fmt.Sprintf("  const %s = {};\n", paramsVariableName)
					} else {
						k6Code += fmt.Sprintf("  const %s = %s;\n", paramsVariableName, string(paramsJSON))
					}
				}
			} else {
				k6Code += fmt.Sprintf("  const %s = {};\n", paramsVariableName)
			}
		} else {
			k6Code += fmt.Sprintf("  const %s = {};\n", paramsVariableName)
		}

		// Construct k6 request
		k6Code += fmt.Sprintf("  let %s = http.%s(%s, %s, { headers: %s, params: %s });\n", resVariableName, method, urlVariableName, bodyVariableName, headersVariableName, paramsVariableName)
		k6Code += fmt.Sprintf("  %sTrend.add(%s.timings.waiting);\n", operationID, resVariableName)
		k6Code += fmt.Sprintf("  check(%s, {\n    %s_status_200_check: (r) => r.status === 200,\n  });\n", resVariableName, operationID)
	}

	k6Code += `}
`
	return k6Code, nil
}
// Part 5: generateReport, validateSwaggerAndFiles, and main Functions

func generateReport(validationReport ValidationReport) {
	fmt.Println("\n====================================")
	fmt.Println("      VALIDATION REPORT")
	fmt.Println("====================================\n")

	if validationReport.MissingServerURL {
		fmt.Println("■ Server URL is missing in the Swagger file")
	}

	if len(validationReport.MissingFiles) > 0 {
		fmt.Println("\n■ Missing files:")
		for _, item := range validationReport.MissingFiles {
			fmt.Printf("  - %s (%s parameter for operation: %s)\n", item.File, item.Type, item.OperationID)
		}
	}

	if len(validationReport.EmptyValues) > 0 {
		fmt.Println("\n■ Files with empty values:")
		for _, item := range validationReport.EmptyValues {
			fmt.Printf("  - %s (%s parameter for operation: %s)\n", item.File, item.Type, item.OperationID)
		}
	}

	fmt.Println("\n■ Endpoints validated:")
	for operationID, details := range validationReport.Endpoints {
		fmt.Printf("  - %s (%s %s)\n", operationID, strings.ToUpper(details.Method), details.Path)

		if len(details.QueryParams) > 0 {
			fmt.Println("    Query parameters:", strings.Join(details.QueryParams, ", "))
		}

		if len(details.HeaderParams) > 0 {
			fmt.Println("    Header parameters:", strings.Join(details.HeaderParams, ", "))
		}

		if len(details.Issues) > 0 {
			fmt.Println("    Issues found:")
			for _, issue := range details.Issues {
				if len(issue.MissingParameters) > 0 {
					fmt.Printf("      * File %s is missing parameters: %s\n", issue.File, strings.Join(issue.MissingParameters, ", "))
				}
				if len(issue.EmptyParameters) > 0 {
					fmt.Printf("      * File %s has empty parameters: %s\n", issue.File, strings.Join(issue.EmptyParameters, ", "))
				}
				if len(issue.MissingRequiredProperties) > 0 {
					fmt.Printf("      * File %s is missing required properties: %s\n", issue.File, strings.Join(issue.MissingRequiredProperties, ", "))
				}
				if len(issue.TypeValidationErrors) > 0 {
					fmt.Printf("      * File %s has type validation errors: %s\n", issue.File, strings.Join(issue.TypeValidationErrors, ", "))
				}
				if issue.Issue != "" {
					fmt.Printf("      * File %s: %s\n", issue.File, issue.Issue)
				}
			}
		}
	}

	hasIssues := validationReport.MissingServerURL ||
		len(validationReport.MissingFiles) > 0 ||
		len(validationReport.EmptyValues) > 0
	for _, endpoint := range validationReport.Endpoints {
		if len(endpoint.Issues) > 0 {
			hasIssues = true
			break
		}
	}

	fmt.Println("\n====================================")
	if hasIssues {
		fmt.Println("✘ Validation completed with issues")
	} else {
		fmt.Println("✓ Validation completed successfully")
	}
	fmt.Println("====================================")
}

func validateSwaggerAndFiles() error {
	folderPath := os.Args[1]
	if folderPath == "" {
		return fmt.Errorf("please provide a folder path as an argument")
	}

	fmt.Println("Checking folder:", folderPath)

	fitnessPath := filepath.Join(folderPath, "fitness")

	if !directoryExists(fitnessPath) {
		return fmt.Errorf("fitness folder does not exist")
	}

	files, err := ioutil.ReadDir(fitnessPath)
	if err != nil {
		return err
	}
	fmt.Println("\nFiles in fitness folder:")
	for _, file := range files {
		fmt.Println("-", file.Name())
	}

	swaggerFile, err := findSwaggerFile(fitnessPath)
	if err != nil {
		return err
	}
	if swaggerFile == "" {
		return fmt.Errorf("\nno swagger/openapi file found. Please check fitness folder")
	}

	fmt.Println("\nFound Swagger/OpenAPI file:", swaggerFile)

	// Read the Swagger content only once, outside the environment loop
	swaggerContent, err := readFileContent(filepath.Join(fitnessPath, swaggerFile))
	if err != nil {
		return fmt.Errorf("could not read Swagger file content: %w", err)
	}

	var swagger map[string]interface{}
	if err := json.Unmarshal([]byte(swaggerContent), &swagger); err != nil {
		fmt.Println("JSON parsing failed, attempting to parse as YAML...")
		if err := yaml.Unmarshal([]byte(swaggerContent), &swagger); err != nil {
			return fmt.Errorf("YAML parsing failed: %w. Please convert your Swagger/OpenAPI file to JSON format", err)
		}
	}

	// Detect environment folders
	environmentFolders := detectEnvironmentFolders(fitnessPath)
	fmt.Println("\nDetected environment folders:", environmentFolders)

	atLeastOneSuccess := false
	successEnvironments := []string{}
	failedEnvironments := []string{}
	failureReasons := make(map[string]string)

	for _, environment := range environmentFolders {
		fmt.Println("\n====================================================")
		fmt.Println("  Validating environment:", environment)
		fmt.Println("====================================================")
		envFitnessPath := filepath.Join(fitnessPath, environment)

		if !directoryExists(envFitnessPath) {
			fmt.Printf("Environment folder %s does not exist, skipping.\n", environment)
			failedEnvironments = append(failedEnvironments, environment)
			failureReasons[environment] = "Environment folder does not exist"
			continue
		}

		validationReport := createValidationReport()
		// Pass fs and path to validateSwagger
		if err := validateSwagger(swagger, envFitnessPath, &validationReport); err != nil {
			fmt.Printf("Error validating Swagger for environment %s: %v\n", environment, err)
			failedEnvironments = append(failedEnvironments, environment)
			failureReasons[environment] = fmt.Sprintf("Swagger validation error: %v", err)
			continue
		}

		generateReport(validationReport)

		hasIssues := validationReport.MissingServerURL ||
			len(validationReport.MissingFiles) > 0 ||
			len(validationReport.EmptyValues) > 0
		for _, endpoint := range validationReport.Endpoints {
			if len(endpoint.Issues) > 0 {
				hasIssues = true
				break
			}
		}

		if !hasIssues {
			atLeastOneSuccess = true
			fmt.Println("\nGenerating k6 script for environment:", environment)
			k6Script, err := generateK6Script(swagger, validationReport, environment)
			if err != nil {
				fmt.Printf("Error generating k6 script: %v\n", err)
				failedEnvironments = append(failedEnvironments, environment)
				failureReasons[environment] = fmt.Sprintf("K6 script generation error: %v", err)
			} else {
				k6FileName := fmt.Sprintf("vpe-default-k6-swagger_%s.js", environment) // Updated file name
				k6FilePath := filepath.Join(folderPath, k6FileName)

				err = ioutil.WriteFile(k6FilePath, []byte(k6Script), 0644)
				if err != nil {
					fmt.Printf("Error writing k6 script to file: %v\n", err)
					failedEnvironments = append(failedEnvironments, environment)
					failureReasons[environment] = fmt.Sprintf("Error writing k6 script to file: %v", err)
				} else {
					fmt.Println("----------------------------------------------------")
					fmt.Printf("  Successfully generated k6 script: %s\n", k6FileName) // Updated output
					fmt.Println("----------------------------------------------------")
					successEnvironments = append(successEnvironments, environment)
				}
			}
		} else {
			fmt.Printf("Skipping k6 script generation for %s due to validation issues.\n", environment)
			failedEnvironments = append(failedEnvironments, environment)
			failureReasons[environment] = "Validation issues found"
		}
		fmt.Println() // Add an empty line for better separation
	}

	// Create or append to env_vars file only if at least one test script is successfully generated
	if len(successEnvironments) > 0 {
		envVarsFileName := filepath.Join(folderPath, "env_vars")
		envVarsContent := "export testType=default\nexport swagger=true\n"

		// Check if the file exists
		if _, err := os.Stat(envVarsFileName); os.IsNotExist(err) {
			// Create the file if it doesn't exist
			err = ioutil.WriteFile(envVarsFileName, []byte(envVarsContent), 0644)
			if err != nil {
				fmt.Printf("Error creating env_vars file: %v\n", err)
			} else {
				fmt.Println("Successfully created env_vars file")
			}
		} else {
			// Append to the file if it exists
			f, err := os.OpenFile(envVarsFileName, os.O_APPEND|os.O_WRONLY, 0644)
			if err != nil {
				fmt.Printf("Error opening env_vars file: %v\n", err)
			} else {
				defer f.Close()
				if _, err := f.WriteString(envVarsContent); err != nil {
					fmt.Printf("Error appending to env_vars file: %v\n", err)
				} else {
					fmt.Println("Successfully appended to env_vars file")
				}
			}
		}
	}

	fmt.Println("\n====================================================")
	fmt.Println("             SUMMARY")
	fmt.Println("====================================================")

	if len(successEnvironments) > 0 {
		fmt.Println("\nSuccessfully generated k6 scripts for:")
		for _, env := range successEnvironments {
			fmt.Println("-", env)
		}
	} else {
		fmt.Println("\nNo k6 scripts were successfully generated.")
	}

	if len(failedEnvironments) > 0 {
		fmt.Println("\nFailed to generate k6 scripts for:")
		for _, env := range failedEnvironments {
			fmt.Printf("- %s: %s\n", env, failureReasons[env])
		}
	}

	if !atLeastOneSuccess && len(failedEnvironments) > 0 {
		return fmt.Errorf("validation failed for all specified environments")
	}

	return nil
}

func detectEnvironmentFolders(fitnessPath string) []string {
	var environmentFolders []string
	files, err := ioutil.ReadDir(fitnessPath)
	if err != nil {
		fmt.Println("Error reading directory:", err)
		return environmentFolders // Return empty slice on error
	}

	for _, file := range files {
		if file.IsDir() {
			name := file.Name()
			baseName := filepath.Base(name) // Get the base name of the folder

			// Check for "dev"
			if strings.Contains(baseName, "dev") {
				if baseName == "dev" || strings.HasPrefix(baseName, "gt-dev") || strings.HasPrefix(baseName, "sw-dev") {
					environmentFolders = append(environmentFolders, name)
				}
			}

			// Check for "uat"
			if strings.Contains(baseName, "uat") {
				if baseName == "uat" || strings.HasPrefix(baseName, "gt-uat") || strings.HasPrefix(baseName, "sw-uat") {
					environmentFolders = append(environmentFolders, name)
				}
			}
		}
	}

	return environmentFolders
}

func main() {
	log.SetFlags(log.LstdFlags | log.Lshortfile)

	if len(os.Args) < 2 {
		fmt.Println("Usage: go run main.go <folder_path>")
		return
	}

	err := validateSwaggerAndFiles()
	if err != nil {
		fmt.Println("Error:", err)
		os.Exit(1)
	}

	fmt.Println("\nCompleted validation and k6 script generation.")
}
