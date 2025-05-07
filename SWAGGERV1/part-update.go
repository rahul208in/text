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
