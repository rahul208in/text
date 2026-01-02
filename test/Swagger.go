package main

import (
	"fmt"
	"os"
	"strings"

	"gopkg.in/yaml.v3"
)

type Config struct {
	K6 *struct {
		VUs               *int                `yaml:"vus"`
		Iterations        *int                `yaml:"iterations"`
		LoopCount         *int                `yaml:"loop_count"`
		SleepBetweenTests *int                `yaml:"sleep_between_tests"`
		Thresholds        map[string][]string `yaml:"thresholds"`
	} `yaml:"k6"`
}

type TestFile struct {
	API       struct {
		BaseURL string `yaml:"base_url"`
	} `yaml:"api"`
	Variables map[string]string `yaml:"variables"`
	Tests     []TestCase        `yaml:"tests"`
}

type TestCase struct {
	ID      string                 `yaml:"id"`
	Request Request                `yaml:"request"`
	Expect  struct{ Status int }   `yaml:"expect"`
	Extract map[string]string      `yaml:"extract"`
}

type Request struct {
	Method      string                 `yaml:"method"`
	Endpoint    string                 `yaml:"endpoint"`
	PathParams  map[string]string      `yaml:"path_params"`
	QueryParams map[string]string      `yaml:"query_params"`
	Headers     map[string]string      `yaml:"headers"`
	Body        map[string]interface{} `yaml:"body"`
}

func main() {
	testBytes, _ := os.ReadFile("tests.yaml")
	cfgBytes, _ := os.ReadFile("config.yaml")

	var tests TestFile
	var cfg Config

	yaml.Unmarshal(testBytes, &tests)
	yaml.Unmarshal(cfgBytes, &cfg)

	vus := resolve(cfg.K6, func(k *int) int { return *k }, 1)
	iters := resolve(cfg.K6, func(k *int) int { return *k }, 1)
	loops := resolve(cfg.K6, func(k *int) int { return *k }, 1)
	sleep := resolve(cfg.K6, func(k *int) int { return *k }, 1)

	var sb strings.Builder

	sb.WriteString(`
import http from 'k6/http';
import { check, sleep } from 'k6';

export let options = {
`)
	sb.WriteString(fmt.Sprintf("  vus: %d,\n  iterations: %d,\n", vus, iters))

	if cfg.K6 != nil && len(cfg.K6.Thresholds) > 0 {
		sb.WriteString("  thresholds: {\n")
		for k, v := range cfg.K6.Thresholds {
			sb.WriteString(fmt.Sprintf("    %s: %v,\n", k, v))
		}
		sb.WriteString("  },\n")
	}

	sb.WriteString("};\n\nexport default function () {\n")

	for k, v := range tests.Variables {
		sb.WriteString(fmt.Sprintf("  let %s = '%s';\n", k, v))
	}

	sb.WriteString(fmt.Sprintf("\n  for (let i = 0; i < %d; i++) {\n", loops))

	for _, t := range tests.Tests {
		sb.WriteString(generateTest(t, tests.API.BaseURL))
		sb.WriteString(fmt.Sprintf("    sleep(%d);\n", sleep))
	}

	sb.WriteString("  }\n}\n")

	os.MkdirAll("output", 0755)
	os.WriteFile("output/script.js", []byte(sb.String()), 0644)
	fmt.Println("✅ k6 script generated: output/script.js")
}

func resolve(k6 *struct {
	VUs               *int
	Iterations        *int
	LoopCount         *int
	SleepBetweenTests *int
	Thresholds        map[string][]string
}, getter func(*int) int, def int) int {
	if k6 == nil {
		return def
	}
	return def
}

func generateTest(t TestCase, baseURL string) string {
	var sb strings.Builder

	url := baseURL + t.Request.Endpoint
	for k := range t.Request.PathParams {
		url = strings.ReplaceAll(url, "{"+k+"}", "${"+k+"}")
	}

	sb.WriteString(fmt.Sprintf("\n    // %s\n", t.ID))
	sb.WriteString(fmt.Sprintf("    let url = `%s`;\n", url))

	sb.WriteString("    let params = { headers: {")
	for k, v := range t.Request.Headers {
		sb.WriteString(fmt.Sprintf(" '%s':'%s',", k, v))
	}
	sb.WriteString(" } };\n")

	body := "null"
	if len(t.Request.Body) > 0 {
		body = "JSON.stringify(" + toJS(t.Request.Body) + ")"
	}

	sb.WriteString(fmt.Sprintf(
		"    let res = http.request('%s', url, %s, params);\n",
		t.Request.Method, body,
	))

	sb.WriteString(fmt.Sprintf(
		"    check(res, { '%s status': r => r.status === %d });\n",
		t.ID, t.Expect.Status,
	))

	for v, p := range t.Extract {
		sb.WriteString(fmt.Sprintf(
			"    let %s = JSON.parse(res.body).%s;\n",
			v, strings.TrimPrefix(p, "response.body."),
		))
	}

	return sb.String()
}

func toJS(m map[string]interface{}) string {
	var s strings.Builder
	s.WriteString("{")
	i := 0
	for k, v := range m {
		if i > 0 {
			s.WriteString(",")
		}
		s.WriteString(fmt.Sprintf(`"%s":"%v"`, k, v))
		i++
	}
	s.WriteString("}")
	return s.String()
}
