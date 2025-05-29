package main 

import (
	"bufio"
	"fmt"
	"log"
	//"io/ioutil"
	"os"
	"path/filepath"
	"strings"
	"gopkg.in/yaml.v2"
"github.com/spf13/cobra"
)

type Header struct {
	Name  string `yaml:"name"`
	Value string `yaml:"value"`
}

type BodyJSON struct {
	Name  string `yaml:"name"`
	Value string `yaml:"value"`
}

type CSVJSON struct {
	Name  string `yaml:"name"`
	Value string `yaml:"value"`
}

type RegexExtract struct {
	Name  string `yaml:"name"`
	Type  string `yaml:"type"`
	Value string `yaml:"value"`
	Ordinal string `yaml:"ordinal"`
}

type Extracter struct {
	RegexExtract []RegexExtract `yaml:"regexxteact"`
}

type ExtracterConfig struct {
	Extracter Extracter `yaml:"extracter"`
}

type Endpoint struct {
	LoopCount    int        `yaml:"loopcount"`
	HeadersFile  string     `yaml:"headers"`
	APIName      string     `yaml:"apiname"`
	BodyJSONs    BodyJSONsConfig  `yaml:"bodyjsons"`
	Method       string     `yaml:"method"`
	ResponseString string   `yaml:"responseString"`
	ThinkTime string        `yaml:"thinktime"`
	Domain       string     `yaml:"domain"`
	Title        string     `yaml:"title"`
	ExecuteOnce  bool       `yaml:"executeOnce"`
	RequestInputXML  string       `yaml:"requestInputXML"`
	PathVariables  map[string]string       `yaml:"pathvariables"`
	QueryParams  map[string]string       `yaml:"queryparams"`
	Extracter    string     `yaml:"extracter"`
}


type ThreadGroup struct {
	SessionEndpoint       []Endpoint `yaml:"sessionendpoint"`
	Endpoint             []Endpoint      `yaml:"Endpoint"`
	ThreadLoadPercentage *int           `yaml:"threadLoadPercentage"`
	ThreadLoop             int     `yaml:"threadloop"`
	RampTime             int      `yaml:"ramptime"`
	ExecuteOnce         bool     `yaml:"executeOnce"`
}

type Swaggers struct {
	Domain       string `yaml:"domain"`
	SwaggerName  string      `yaml:"swaggerName"`
}

type RequestInputXML struct {
	ProdExpectedTps    string        `yaml:"prodExpectedTPS"`
	AppdAppName          string        `yaml:"appdappname"`
	SSLRequired        bool          `yaml:"sslrequired"`
	StartTest        bool          `yaml:"startTest"`
	YkVersion       float64      `yaml:"ykVersion"`
	DL				string 		`yaml:"dl"`
	Space 			string			`yaml:"space"`
BitbucketURL 			string			`yaml:"bitbucketurl"`
	Duration           *int          `yaml:"duration"`
	VUsers             *int          `yaml:"vusers"`

	MajorGcTimer       int        `yaml:"majorGcTimer"`
	AppdTierName       string        `yaml:"appdtiername"`
	AppdController     string          `yaml:"appdcontroller"`
	HeapUsed           int          `yaml:"heapUsed"`
	MajorGc            int          `yaml:"majorGc"`
	ProxyRequired      bool          `yaml:"proxyrequired"`
	ApplnName          string        `yaml:"applnName"`
	MicroserviceName   string        `yaml:"microservicename"`
	Org				   string			`yaml:"org"`
	ContainerType      string       `yaml:"containerType"`
	ResponseTime       *float64      `yaml:"responseTime"`
	SplunkURL			string			`yaml:"splunkurl"`
	DepEnvironment		string			`yaml:"depenvironment"`
	Swaggers			Swaggers			`yaml:"swaggers"`
	SplunkIndex			string				`yaml:"splunkindex"`
	CPUPercentage		int			`yaml:"cpuPercentage"`
	ThreadGroup			ThreadGroup		`yaml:"threadgroup"`
	TestType           string        `yaml:"testType"`
	ApiErrors          *float64      `yaml:"apiErrors"`
}

type VPEConfig struct {
	RequestInputXML RequestInputXML `yaml:"RequestInputXML"`
}

type HeadersConfig struct {
	Headers struct {
		Header []Header `yaml:"header"`
	} `yaml:"headers"`
}

type BodyJSONsConfig struct {
	CSVJSON []CSVJSON `yaml:"csvjson"`
	BodyJson []BodyJSON `yaml:"bodyjson"`
}



var vpeconfigFolderPath string
var K6VpeconfigCmd = &cobra.Command{
	Use: "vpeconfig",
	Short: "validate",
	Long: `This command validates`,
	Example: "Vpe config",
	Run: func(cmd *cobra.Command, args []string){
		if vpeconfigFolderPath == ""{
			fmt.Println("Error:- ")
			os.Exit(1)
		}
		err := ValidateVpeconfigAndFiles(vpeconfigFolderPath)

		if err != nil {
			fmt.Println("Error:", err)
			os.Exit(1)
		}
		fmt.Printf("Validation Completed")
	},
}

// func init(){
// 	k6Cmd.AddCommand(K6VpeconfigCmd)
// 	K6VpeconfigCmd.Flags().StringVarP(&vpeconfigFolderPath, "path" , "p","","path to the fitness folder")
// 	K6VpeconfigCmd.MarkFlagRequired("path")
// }

func removeNextClosingBrace(input string) string {
	var result strings.Builder
	for i := 0;i < len(input); i++ {
		if i+2 < len(input) && input[i] == '$' && input[i+1] == '{' {
			i +=2 
			for i < len(input) && input[i] != '}' {
				result.WriteByte(input[i])
				i++
			}

			if i < len(input) && input[i] == '}' {
				continue
			}
		}
		if i < len(input) {
			result.WriteByte(input[i])
		}
	}
	fmt.Println("result: ", result.String())
	if strings.Contains(result.String(), "c_privateClaims") {
		resultStr := result.String()
		resultStr = strings.Replace(resultStr, "{c_privateClaims}", "c_privateClaims[1]", -1)
		result.Reset()
		result.WriteString(resultStr)
	}
	return result.String()
}

func loadEnvVars(filePath string) error {
	file, err := os.Open(filePath)
	if err != nil {
			return err
		}
		defer file.Close()
		scanner:= bufio.NewScanner(file)
		for scanner.Scan(){
			line := scanner.Text()
			if strings.HasPrefix(line, "#") || strings.TrimSpace(line) == ""{
				continue
			}
			parts := strings.SplitN(line, "=" , 2)
			if len(parts) != 2 {
				return fmt.Errorf("invalid line: %s", line)
			}

			key := strings.TrimSpace(parts[0])
			value := strings.TrimSpace(parts[1])
		
			err = os.Setenv(key, value)
			if err != nil {
		
				return err
		}
		}
		if err := scanner.Err(); err != nil {
			return err
		}
		return nil
}


func ValidateVpeconfigAndFiles(vpeconfigFolderPath string) error {
	configFilePath := filepath.Join(vpeconfigFolderPath, "Config.yml")
	data, err := os.ReadFile(configFilePath)
	if err != nil {
		return fmt.Errorf("failed to read Config.yml: %w", err)
	}
	fmt.Printf("Successfully read Config.yml:\n")
	var config VPEConfig
	err = yaml.Unmarshal(data, &config)
	if err != nil {
		log.Fatalf("error: %v", err)
	}

	// Modified section: Use pointer for ThreadLoadPercentage and provide a default value
	threadLoadPercentage := config.RequestInputXML.ThreadGroup.ThreadLoadPercentage
	defaultPercentage := 100 // Define a default value
	if threadLoadPercentage == nil {
		// Default to 100 if not provided in YAML
		threadLoadPercentage = &defaultPercentage
	}

	fmt.Printf("After unmarshalling: ThreadLoadPercentage = %d, VUsers = %+v\n", *threadLoadPercentage, config.RequestInputXML.VUsers)

	// Modified section: Get the test type from the configuration
	testType := config.RequestInputXML.TestType
	if testType == "" {
		fmt.Println("TestType is empty")
	}
	fmt.Printf("Test Type: %s\n", testType)

	// Modified section: Create the env_vars file in the temporary directory
	envVarsFilePath := filepath.Join(vpeconfigFolderPath, "env_vars")
	file, err := os.Create(envVarsFilePath)
	if err != nil {
		fmt.Println("Error creating file;", err)
		return nil
	}
	defer file.Close()

	// Directly write the values to the env_vars file
	envVars := []string{
		fmt.Sprintf("export ApplnName=\"%s\"\n", config.RequestInputXML.ApplnName),
		fmt.Sprintf("export MicroserviceName=\"%s\"\n", config.RequestInputXML.MicroserviceName),
		fmt.Sprintf("export TestType=\"%s\"\n", testType), // Use the testType variable
		fmt.Sprintf("export Dl=\"%s\"\n", config.RequestInputXML.DL),
	}

	for _, envVar := range envVars {
		if _, err := file.WriteString(envVar); err != nil {
			fmt.Println("Error writing to file:", err)
			return nil
		}
	}

	fmt.Println("Environment variables written to env_vars")

	// Modified section: Check if VUsers is nil *before* accessing ThreadLoadPercentage
	if config.RequestInputXML.VUsers == nil && *threadLoadPercentage != defaultPercentage {
		log.Fatalf("Error: VUsers must be provided when ThreadLoadPercentage is not 100")
	} else if config.RequestInputXML.VUsers != nil && *threadLoadPercentage != defaultPercentage {
		vusers := (float64(*config.RequestInputXML.VUsers) * float64(*threadLoadPercentage)) / 100
		*config.RequestInputXML.VUsers = int(vusers)
	}

	testTypeList := strings.Split(testType, ",")

	for _, testType := range testTypeList {
		testType = strings.TrimSpace(testType)

		var jsCode strings.Builder
		jsCode.WriteString("import http from 'k6/http';\n")
		jsCode.WriteString("import { check, sleep } from 'k6';\n")

		if testType != "" {
			jsCode.WriteString(fmt.Sprintf("//testType=%s\n", testType))
		}
		if config.RequestInputXML.ApiErrors != nil {
			jsCode.WriteString(fmt.Sprintf("//apiError=%.2f\n", *config.RequestInputXML.ApiErrors))
		}
		if config.RequestInputXML.ResponseTime != nil {
			jsCode.WriteString(fmt.Sprintf("//responseTime=%.2f\n", *config.RequestInputXML.ResponseTime))
		}
		if config.RequestInputXML.Duration != nil {
			jsCode.WriteString(fmt.Sprintf("//duration=%d\n", *config.RequestInputXML.Duration))
		}
		if config.RequestInputXML.VUsers != nil {
			jsCode.WriteString(fmt.Sprintf("//vusers=%d\n\n", *config.RequestInputXML.VUsers))
		}

		var optionsBlock strings.Builder // Use a string builder for options block

		if testType == "soak" {
			if !config.RequestInputXML.SSLRequired {
				optionsBlock.WriteString("export const options = {\n insecureSkipTlsVerify: true,\n};\n")
			} else {
				optionsBlock.WriteString("export const options = {};\n")
			}
		} else if testType == "sanity" {
			if !config.RequestInputXML.SSLRequired {
				optionsBlock.WriteString("export const options = {\n insecureSkipTlsVerify: true,\n};\n")
			} else {
				optionsBlock.WriteString("export const options = {};\n")
			}
		} else if testType == "functional" {
			if !config.RequestInputXML.SSLRequired {
				optionsBlock.WriteString("export const options = {\n insecureSkipTlsVerify: true,\n};\n")
			} else {
				optionsBlock.WriteString("export const options = {};\n")
			}
		} else if testType == "breakpoint" {
			if !config.RequestInputXML.SSLRequired {
				optionsBlock.WriteString("export const options = {\n insecureSkipTlsVerify: true,\n};\n")
			} else {
				optionsBlock.WriteString("export const options = {\n executor: 'ramping-vus',\n};\n")
			}
		} else if testType == "smoke" {
			if !config.RequestInputXML.SSLRequired {
				optionsBlock.WriteString("export const options = {\n insecureSkipTlsVerify: true,\n};\n")
			} else {
				optionsBlock.WriteString("export const options = {\n vus: 3, duration: '10s',\n};\n")
			}
		} else if testType == "load" {
			if !config.RequestInputXML.SSLRequired {
				optionsBlock.WriteString("export const options = {\n insecureSkipTlsVerify: true,\n};\n")
			} else {
				optionsBlock.WriteString("export const options = {};\n")
			}
		} else {
			if !config.RequestInputXML.SSLRequired {
				optionsBlock.WriteString("export const options = {\n insecureSkipTlsVerify: true,\n};\n")
			} else {
				optionsBlock.WriteString("export const options = {};\n")
			}
		}
		jsCode.WriteString(optionsBlock.String()) // Append the options block

		for _, sessionEndpoint := range config.RequestInputXML.ThreadGroup.SessionEndpoint {
			jsCode.WriteString(fmt.Sprintf("const %s = new Trend('%s'); \n", sessionEndpoint.Title, sessionEndpoint.Title))
		}
		for _, endpoint := range config.RequestInputXML.ThreadGroup.Endpoint {
			jsCode.WriteString(fmt.Sprintf("const %s = new Trend('%s'); \n", endpoint.Title, endpoint.Title))
		}

		jsCode.WriteString("export default function () {\n")

		for sessionEndpointIndex, sessionEndpoint := range config.RequestInputXML.ThreadGroup.SessionEndpoint {
			fmt.Printf("######## Title: %s\n", sessionEndpoint.Title)
			headersData, err := os.ReadFile(filepath.Join(vpeconfigFolderPath, sessionEndpoint.HeadersFile))
			if err != nil {
				log.Fatalf("error: %v", err)
			}

			var headersConfig HeadersConfig
			err = yaml.Unmarshal(headersData, &headersConfig)
			if err != nil {
				log.Fatalf("error: %v", err)
			}

			jsCode.WriteString(fmt.Sprintf("const session_headers_%d = {\n", sessionEndpointIndex))
			for _, header := range headersConfig.Headers.Header {
				if header.Name != "" {

					if !strings.Contains(header.Name, "${") && !strings.Contains(header.Value, "${") {
						jsCode.WriteString(fmt.Sprintf(" '%s': '%s',\n", header.Name, header.Value))
					} else {
						headerNameFound := false
						headerValueFound := false

						if strings.Contains(header.Name, "${") && strings.Contains(header.Name, "}") {
							header.Name = strings.ReplaceAll(header.Name, "${", "")
							header.Name = strings.ReplaceAll(header.Name, "}", "")
							headerNameFound = true
						}

						if strings.Contains(header.Value, "${") && strings.Contains(header.Value, "}") {
							header.Value = strings.ReplaceAll(header.Value, "${", "")
							header.Value = strings.ReplaceAll(header.Name, "}", "")
							headerValueFound = true
						}

						if headerNameFound && headerValueFound {
							jsCode.WriteString(fmt.Sprintf(" %s: %s,\n", header.Name, header.Value))
						} else if headerNameFound && !headerValueFound {
							jsCode.WriteString(fmt.Sprintf(" %s: '%s',\n", header.Name, header.Value))
						} else if !headerNameFound && headerValueFound {
							jsCode.WriteString(fmt.Sprintf(" '%s': %s,\n", header.Name, header.Value))
						} else {
							jsCode.WriteString(fmt.Sprintf(" '%s': '%s',\n", header.Name, header.Value))
						}
					}
				}
			}

			jsCode.WriteString("};\n")

			bodyFound := false
			var queryArray []string
			var pathVarArray []string
			for bodyIndex, bodyjson := range sessionEndpoint.BodyJSONs.BodyJson {
				bodyFound = false
				if strings.HasSuffix(bodyjson.Value, ".txt") || strings.HasSuffix(bodyjson.Value, ".json") {
					bodyJSONsData, err := os.ReadFile(filepath.Join(vpeconfigFolderPath, bodyjson.Value))
					if err != nil {
						log.Fatalf("error: %v", err)
					}
					// Convert bodyJSONsData to string
					bodyJSONsDataStr := string(bodyJSONsData)
					bodyJSONsDataStr = removeNextClosingBrace(bodyJSONsDataStr)
					bodyJSONsData = []byte(bodyJSONsDataStr)

					jsCode.WriteString(fmt.Sprintf("const session_body_%d_%d = `%s`;\n", sessionEndpointIndex, bodyIndex, string(bodyJSONsData))) // Use backticks for multiline strings
					bodyFound = true
				} else {
					if sessionEndpoint.APIName != "" && strings.Contains(sessionEndpoint.APIName, "{"+bodyjson.Name+"}") {
						pathVarArray = append(queryArray, fmt.Sprintf("%s=%s", bodyjson.Name, bodyjson.Value))
					} else {
						queryArray = append(queryArray, fmt.Sprintf("%s=%s", bodyjson.Name, bodyjson.Value))
					}
				}
			}

			if len(pathVarArray) > 0 {
				for _, pathVar := range pathVarArray {
					sessionEndpoint.APIName = strings.ReplaceAll(sessionEndpoint.APIName, "{"+strings.Split(pathVar, "=")[0]+"}", strings.Split(pathVar, "=")[1])
				}
			}
			// Check if query params are found
			if len(queryArray) > 0 {
				for _, query := range queryArray {

					if strings.Contains(sessionEndpoint.APIName, "?") {
						sessionEndpoint.APIName = sessionEndpoint.APIName + "&" + query
					} else {
						sessionEndpoint.APIName = sessionEndpoint.APIName + "?" + query
					}
				}
			}

			fmt.Printf("Session API Name: %s\n", sessionEndpoint.APIName)
			jsCode.WriteString(fmt.Sprintf("const session_url_%d = '%s';\n", sessionEndpointIndex, sessionEndpoint.APIName))

			if bodyFound {
				jsCode.WriteString(fmt.Sprintf("let session_res_%d = http.%s(session_url_%d, JSON.stringify(session_body_%d_0), {headers: session_headers_%d});\n", sessionEndpointIndex, strings.ToLower(sessionEndpoint.Method), sessionEndpointIndex, sessionEndpointIndex, sessionEndpointIndex))
			} else {
				jsCode.WriteString(fmt.Sprintf("let session_res_%d = http.%s(session_url_%d, null, {headers: session_headers_%d});\n", sessionEndpointIndex, strings.ToLower(sessionEndpoint.Method), sessionEndpointIndex, sessionEndpointIndex))
			}
			jsCode.WriteString(fmt.Sprintf("%s.add(session_res_%d.timings.waiting);\n", sessionEndpoint.Title, sessionEndpointIndex))

			jsCode.WriteString(fmt.Sprintf("check(session_res_%d, {\n", sessionEndpointIndex))
			jsCode.WriteString(fmt.Sprintf("'%s_status_200_check': (r) => r.status == 200,\n", sessionEndpoint.Title))

			if sessionEndpoint.ResponseString != "" {
				jsCode.WriteString(fmt.Sprintf("'%s_verify_response_text': (r) => r.body.includes('%s'),\n", sessionEndpoint.Title, sessionEndpoint.ResponseString))
			}
			jsCode.WriteString("});\n")
			jsCode.WriteString("sleep(1);\n")

			if sessionEndpoint.Extracter != "" {
				extracterData, err := os.ReadFile(filepath.Join(vpeconfigFolderPath, sessionEndpoint.Extracter))
				if err != nil {
					log.Fatalf("error: %v", err)
				}
				var extracterConfig ExtracterConfig
				err = yaml.Unmarshal(extracterData, &extracterConfig)
				if err != nil {
					log.Fatalf("error: %s", err)
				}
				fmt.Printf("Parsed ExtracterConfig: %+v\n", extracterConfig)

				for _, regexExtract := range extracterConfig.Extracter.RegexExtract {
					if regexExtract.Type == "header" {
						jsCode.WriteString(fmt.Sprintf("let %s = session_res_%d.headers['%s'];\n", regexExtract.Name, sessionEndpointIndex, strings.Split(regexExtract.Value, ":")[0]))
					} else if regexExtract.Type == "body" {
						jsCode.WriteString(fmt.Sprintf("let %s = session_res_%d.body.match(/%s/);\n", regexExtract.Name, sessionEndpointIndex, regexExtract.Value))

						if strings.Contains(regexExtract.Value, "privateClaims") {
							jsCode.WriteString(fmt.Sprintf("if (%s && %s[1]) { %s[1] = JSON.parse(\"{\"+%s[1]+\"}\"); }\n", regexExtract.Name, regexExtract.Name, regexExtract.Name, regexExtract.Name))
						}
					}
				}
			}
		}

		for endpointIndex, endpoint := range config.RequestInputXML.ThreadGroup.Endpoint {
			headersData, err := os.ReadFile(filepath.Join(vpeconfigFolderPath, endpoint.HeadersFile))

			if err != nil {
				log.Fatalf("error: %v", err)
			}

			var headersConfig HeadersConfig
			err = yaml.Unmarshal(headersData, &headersConfig)
			if err != nil {
				log.Fatalf("error: %v", err)
			}

			jsCode.WriteString(fmt.Sprintf("const headers_%d = {\n", endpointIndex))
			for _, header := range headersConfig.Headers.Header {
				if header.Name != "" {
					if !strings.Contains(header.Name, "${") && !strings.Contains(header.Value, "${") {
						jsCode.WriteString(fmt.Sprintf(" '%s': '%s',\n", header.Name, header.Value))
					} else {
						headerNameFound := false
						headerValueFound := false

						if strings.Contains(header.Name, "${") && strings.Contains(header.Name, "}") {
							header.Name = strings.Replace(header.Name, "${", "", -1)
							header.Name = strings.Replace(header.Name, "}", "", -1)
							headerNameFound = true
						}
						if strings.Contains(header.Value, "${") && strings.Contains(header.Value, "}") {
							header.Value = strings.Replace(header.Value, "${", "", -1)
							header.Value = strings.Replace(header.Value, "}", "", -1)
							headerValueFound = true
						}

						if headerNameFound && headerValueFound {
							jsCode.WriteString(fmt.Sprintf(" %s: %s,\n", header.Name, header.Value))
						} else if headerNameFound && !headerValueFound {
							jsCode.WriteString(fmt.Sprintf(" %s: '%s',\n", header.Name, header.Value))
						} else if !headerNameFound && headerValueFound {
							jsCode.WriteString(fmt.Sprintf(" '%s': %s,\n", header.Name, header.Value))
						} else {
							jsCode.WriteString(fmt.Sprintf(" '%s': '%s',\n", header.Name, header.Value))
						}
					}
				}
			}
			jsCode.WriteString("};\n")

			bodyFound := false
			var queryArray []string
			var pathVarArray []string

			for bodyIndex, bodyjson := range endpoint.BodyJSONs.BodyJson {
				bodyFound = false
				if strings.HasSuffix(bodyjson.Value, ".txt") || strings.HasSuffix(bodyjson.Value, ".json") {
					bodyJSONsData, err := os.ReadFile(filepath.Join(vpeconfigFolderPath, bodyjson.Value))
					if err != nil {
						log.Fatalf("error: %v", err)
					}

					bodyJSONsDataStr := string(bodyJSONsData)
					bodyJSONsDataStr = removeNextClosingBrace(bodyJSONsDataStr)
					bodyJSONsData = []byte(bodyJSONsDataStr)

					jsCode.WriteString(fmt.Sprintf("const body_%d_%d = `%s`;\n", endpointIndex, bodyIndex, string(bodyJSONsData))) // Use backticks for multiline strings
					bodyFound = true
				} else {
					if endpoint.APIName != "" && strings.Contains(endpoint.APIName, "{"+bodyjson.Name+"}") {
						pathVarArray = append(queryArray, fmt.Sprintf("%s=%s", bodyjson.Name, bodyjson.Value))
					} else {
						queryArray = append(queryArray, fmt.Sprintf("%s=%s", bodyjson.Name, bodyjson.Value))
					}
				}
			}

			if len(pathVarArray) > 0 {
				for _, pathVar := range pathVarArray {
					endpoint.APIName = strings.ReplaceAll(endpoint.APIName, "{"+strings.Split(pathVar, "=")[0]+"}", strings.Split(pathVar, "=")[1])
				}
			}

			if len(queryArray) > 0 {
				for _, query := range queryArray {
					if strings.Contains(endpoint.APIName, "?") {
						endpoint.APIName = endpoint.APIName + "&" + query
					} else {
						endpoint.APIName = endpoint.APIName + "?" + query
					}
				}
			}

			fmt.Printf("API Name: %s\n", endpoint.APIName)
			jsCode.WriteString(fmt.Sprintf("const url_%d = '%s%s';\n", endpointIndex, endpoint.Domain, endpoint.APIName))
			loopCount := endpoint.LoopCount
			if endpoint.ExecuteOnce {
				loopCount = 1
			}
			jsCode.WriteString(fmt.Sprintf("for (let i = 0; i < %d; i++) {\n", loopCount))
			if bodyFound {
				jsCode.WriteString(fmt.Sprintf("let res_%d = http.%s(url_%d, JSON.stringify(body_%d_0), {headers: headers_%d});\n", endpointIndex, strings.ToLower(endpoint.Method), endpointIndex, endpointIndex, endpointIndex))
			} else {
				jsCode.WriteString(fmt.Sprintf("let res_%d = http.%s(url_%d, null, {headers: headers_%d});\n", endpointIndex, strings.ToLower(endpoint.Method), endpointIndex, endpointIndex))
			}

			jsCode.WriteString(fmt.Sprintf("%s.add(res_%d.timings.waiting);\n", endpoint.Title, endpointIndex))
			jsCode.WriteString(fmt.Sprintf("check(res_%d, {\n", endpointIndex))
			jsCode.WriteString(fmt.Sprintf("'%s_status_200_check': (r) => r.status == 200,\n", endpoint.Title))

			if endpoint.ResponseString != "" {
				jsCode.WriteString(fmt.Sprintf("'%s_verify_response_text': (r) => r.body.includes('%s'),\n", endpoint.Title, endpoint.ResponseString))
			}
			jsCode.WriteString("});\n")

			if endpoint.Extracter != "" {
				extracterData, err := os.ReadFile(filepath.Join(vpeconfigFolderPath, endpoint.Extracter))
				if err != nil {
					log.Fatalf("error: %v", err)
				}
				var extracterConfig ExtracterConfig
				err = yaml.Unmarshal(extracterData, &extracterConfig)
				if err != nil {
					log.Fatalf("error: %v", err)
				}

				fmt.Printf("Parsed ExtracterConfig: %+v\n", extracterConfig)

				for _, regexExtract := range extracterConfig.Extracter.RegexExtract {
					if regexExtract.Type == "header" {
						jsCode.WriteString(fmt.Sprintf("let %s = res_%d.headers['%s'];\n", regexExtract.Name, endpointIndex, strings.Split(regexExtract.Value, ":")[0]))
					} else if regexExtract.Type == "body" {
						jsCode.WriteString(fmt.Sprintf("let %s = res_%d.body.match(/%s/);\n", regexExtract.Name, endpointIndex, regexExtract.Value))
					}
				}
			}
			jsCode.WriteString("}\n") // Closing the loopCount for loop
		}
		jsCode.WriteString("}\n") // Closing the default function

		jsCode.WriteString("// Generate HTML Report\n")
		jsCode.WriteString("// export function handleSummary(data) {\n")
		jsCode.WriteString(" // return {\n")
		jsCode.WriteString(fmt.Sprintf(" // \"%s-summary.html\": htmlReport(data),\n", testType))
		jsCode.WriteString(fmt.Sprintf(" // \"%s-summary.json\": JSON.stringify(data),\n", testType))
		jsCode.WriteString(" // };\n")
		jsCode.WriteString("// }\n")

		// Modified section: Use the testType variable to generate the k6 script file name
		k6ScriptFileName := filepath.Join(vpeconfigFolderPath, fmt.Sprintf("vpe-%s-script.js", testType))
		err = os.WriteFile(k6ScriptFileName, []byte(jsCode.String()), 0644)
		if err != nil {
			log.Fatalf("error: %v", err)
		}
		fmt.Println(k6ScriptFileName, "has been generated successfully.")

		fmt.Println("=========================================================")
		//err = loadEnvVars("env_vars")
		//if err != nil {
		//	fmt.Printf("Error loading env_vars file: %s\n", err)
		//	return nil
		//}
		dl := os.Getenv("Dl")
		fmt.Println("Email", dl)

		fmt.Println("Validating the generated", k6ScriptFileName, "test")
	}
	fmt.Println("All files validated")
	return nil
}
