
package main

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"log"
	"os"
	"strings"
	"text/template"
)

// TestCase represents a single test case
type TestCase struct {
	Name     string `json:"name"`
	URL      string `json:"url"`
	Selector string `json:"selector"`
	Text     string `json:"text"`
}

// Config represents the configuration for k6 script generation
type Config struct {
	BaseURL   string     `json:"baseUrl"`
	TestCases []TestCase `json:"testCases"`
}

const k6Template = `import { browser } from 'k6/browser';
import htmlReport from './bundle.js';
import { check } from 'k6';

const apiErrors = __ENV.apiErrors || "0.01"; // Default to 0.01 if not set
const responseTime = __ENV.responseTime || "300"; // Default to 300ms if not set

export const options = {
    insecureSkipTLSVerify: true,
    thresholds: {
        browser_http_req_failed: [{
            threshold: 'rate<' + apiErrors,
            abortOnFail: false
        }],
        browser_http_req_duration: [{
            threshold: 'avg<' + responseTime,
            abortOnFail: false
        }],
    },
    scenarios: {
        browser_test: {
            executor: 'constant-vus',
            vus: 1,
            duration: "30s",
            options: {
                browser: {
                    type: 'chromium',
                    headless: true,
                }
            }
        }
    }
};

export default async function () {
    const browserInstance = await browser.newPage(); // Create a new browser instance
    const page = browserInstance;
{{range $index, $test := .TestCases}}
    console.log('Navigating to {{$.BaseURL}}{{$test.URL}}');
    await page.goto('{{$.BaseURL}}{{$test.URL}}');
    const pageVisible_{{add $index 1}} = await page.waitForSelector('body', { state: 'visible', timeout: 5000 });
    const pageNavigated_{{add $index 1}} = check(pageVisible_{{add $index 1}}, {
        '{{$test.Name}} navigated successfully to {{$.BaseURL}}{{$test.URL}}': (element) => element !== null
    });

    const navigationScreenshotPath_{{add $index 1}} = 'screenshot_navigation_{{add $index 1}}.png';
    await page.screenshot({ fullPage: true, path: navigationScreenshotPath_{{add $index 1}} });
    console.log(` + "`" + `Screenshot saved at: screenshot_navigation_{{add $index 1}}.png` + "`" + `);

    if (!pageNavigated_{{add $index 1}}) {
        console.error('Failed to navigate to URL.');
        check(null, { "{{$test.Name}} navigation failed to {{$.BaseURL}}{{$test.URL}}": false });
        return;
    }

    try {
        console.log('Checking for text: "{{$test.Text}}"...');
        const elementText_{{add $index 1}} = await page.locator('{{$test.Selector}}').textContent();
        const textCheck_{{add $index 1}} = check(elementText_{{add $index 1}}, {
            "{{$test.Name}} Text '{{$test.Text}}' is present on the page": (text) => text && text.includes('{{$test.Text}}')
        });

        if (!textCheck_{{add $index 1}}) {
            console.error('Text "{{$test.Text}}" not found on the page.');
            check(null, { '{{$test.Name}} Text "{{$test.Text}}" presence check failed': false });
        }
    } catch (error) {
        console.error('Error while checking for text: "{{$test.Text}}"', error.message);
        check(null, { '{{$test.Name}} Text "{{$test.Text}}" presence check failed': false });
    }

    const screenshotPath_{{add $index 1}} = 'screenshot_{{$test.Name}}_{{add $index 1}}.png';
    await page.screenshot({ fullPage: true, path: screenshotPath_{{add $index 1}} });
    console.log('Screenshot saved at: screenshot_{{$test.Name}}_{{add $index 1}}.png');
    console.log('{{$test.Name}} completed.');
{{end}}
    await page.close();
}

export function handleSummary(data) {
    return {
        'default-summary.html': htmlReport(data),
        'default-summary.json': JSON.stringify(data),
    };
}`

// Refactored functions for testability
func readConfigFile(filename string) (*Config, error) {
	jsonData, err := ioutil.ReadFile(filename)
	if err != nil {
		return nil, fmt.Errorf("error reading config file: %v", err)
	}

	var config Config
	err = json.Unmarshal(jsonData, &config)
	if err != nil {
		return nil, fmt.Errorf("error parsing JSON: %v", err)
	}

	return &config, nil
}

func generateOutputFilename(configFile string) string {
	return strings.TrimSuffix(configFile, ".json") + "_generated.js"
}

func createTemplate() (*template.Template, error) {
	funcMap := template.FuncMap{
		"add": func(a, b int) int {
			return a + b
		},
	}

	tmpl, err := template.New("k6script").Funcs(funcMap).Parse(k6Template)
	if err != nil {
		return nil, fmt.Errorf("error parsing template: %v", err)
	}

	return tmpl, nil
}

func generateScript(config *Config, outputFile string) error {
	tmpl, err := createTemplate()
	if err != nil {
		return err
	}

	file, err := os.Create(outputFile)
	if err != nil {
		return fmt.Errorf("error creating output file: %v", err)
	}
	defer file.Close()

	err = tmpl.Execute(file, config)
	if err != nil {
		return fmt.Errorf("error executing template: %v", err)
	}

	return nil
}

func processConfig(configFile string) error {
	config, err := readConfigFile(configFile)
	if err != nil {
		return err
	}

	outputFile := generateOutputFilename(configFile)
	
	err = generateScript(config, outputFile)
	if err != nil {
		return err
	}

	fmt.Printf("K6 script generated successfully: %s\n", outputFile)
	fmt.Printf("Generated %d test cases\n", len(config.TestCases))
	
	return nil
}

func main() {
	if len(os.Args) < 2 {
		log.Fatal("Usage: go run k6-generator.go <config.json>")
	}

	configFile := os.Args[1]
	
	err := processConfig(configFile)
	if err != nil {
		log.Fatalf("Error: %v", err)
	}
}
