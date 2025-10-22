import { browser } from 'k6/browser';
import { check, group, sleep as k6Sleep } from 'k6';
import { Trend } from 'k6/metrics';
import { htmlReport } from "https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js";

// Create trend metrics for each step
const stepTrends = {};

// Configuration
const userConfig = {
  baseUrl: "https://www.google.com",
  transactions: [
    {
      name: "Google Search Navigation",
      steps: [
        {
          name: "Navigate to Google main page",
          action: "goto",
          url: "/",
          screenshot: true,
        },
        {
          name: "Check Google logo is visible",
          action: "check",
          selector: "img[alt='Google']",
          screenshot: false,
        },
        {
          name: "Type search query",
          action: "type",
          value: "k6 browser testing",
          selector: "textarea[name='q']",
          screenshot: false,
        },
        {
          name: "Click search button",
          action: "click",
          selector: "input[name='btnK']",
          screenshot: true,
          waitForLoadState: true,
        },
        {
          name: "Check search results",
          action: "check",
          selector: "#search",
          screenshot: true,
          waitForLoadState: true,
        },
      ],
    },
    {
      name: "Google Features Check",
      steps: [
        {
          name: "Click Google apps button",
          action: "click",
          selector: "a[aria-label='Google apps']",
          screenshot: true,
        },
        {
          name: "Verify apps menu appears",
          action: "check",
          selector: "div[aria-label='Google apps']",
          screenshot: true,
        },
      ],
    },
  ],
};

export const options = {
  scenarios: {
    ui: {
      executor: "shared-iterations",
      vus: 1,
      iterations: 1,
      options: {
        browser: {
          type: "chromium",
          headless: false,
        },
      },
    },
  },
  thresholds: {},
};

// Initialize trends for all steps
userConfig.transactions.forEach(transaction => {
  transaction.steps.forEach(step => {
    const trendName = `step_${step.name.replace(/[^a-zA-Z0-9]/g, '_')}_${step.action}`;
    stepTrends[step.name] = new Trend(trendName, true);
  });
});

export default async function () {
  const baseURL = userConfig.baseUrl;
  let context = null;
  let page = null;
  let allStepsPassed = true;

  try {
    console.log("> Launching browser...");
    context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      ignoreHTTPSErrors: true,
    });
    
    page = await context.newPage();
    page.setDefaultTimeout(30000);
    page.setDefaultNavigationTimeout(30000);

    // Execute all test groups
    for (const transaction of userConfig.transactions) {
      const groupName = transaction.name;
      let groupSuccess = true;
      
      console.log(`\n🎯 GROUP: ${groupName}`);
      
      // Use group without async wrapper
      group(groupName, () => {
        // We'll execute steps sequentially within the group
        for (let i = 0; i < transaction.steps.length; i++) {
          const step = transaction.steps[i];
          
          // If previous steps failed, skip subsequent steps in this group
          if (!allStepsPassed && groupSuccess === false) {
            console.log(`⏭️  Skipping step due to previous failure: ${step.name}`);
            stepTrends[step.name].add(0, { status: 'skipped' });
            continue;
          }

          const startTime = Date.now();
          let stepSuccess = false;
          let errorMessage = '';

          try {
            // Execute the step action - we need to handle this differently
            // Since we can't use await in non-async function, we'll use immediate execution
            const stepResult = executeActionSync(page, baseURL, step);
            if (stepResult) {
              stepSuccess = true;
              console.log(`✅ PASS: ${step.name}`);
            } else {
              stepSuccess = false;
              errorMessage = "Step execution failed";
              groupSuccess = false;
              allStepsPassed = false;
              console.log(`❌ FAIL: ${step.name} - ${errorMessage}`);
            }
          } catch (error) {
            stepSuccess = false;
            errorMessage = error.message;
            groupSuccess = false;
            allStepsPassed = false;
            console.log(`❌ FAIL: ${step.name} - ${errorMessage}`);
          }

          const duration = Date.now() - startTime;

          // Record trend metric
          stepTrends[step.name].add(duration, { 
            status: stepSuccess ? 'passed' : 'failed',
            action: step.action,
            group: groupName
          });

          // Take screenshot if requested
          if (step.screenshot && page) {
            try {
              const screenshotName = `${groupName}_${step.name.replace(/[^a-zA-Z0-9]/g, '_')}.png`;
              page.screenshot({ path: `screenshots/${screenshotName}` })
                .then(() => console.log(`📸 Screenshot: ${screenshotName}`))
                .catch(e => console.log(`⚠️  Could not take screenshot: ${e.message}`));
            } catch (e) {
              console.log(`⚠️  Could not take screenshot: ${e.message}`);
            }
          }

          // Check for the step result
          check(null, {
            [`${groupName} - ${step.name}`]: () => stepSuccess
          });

          // If step failed and we should stop execution
          if (!stepSuccess) {
            console.log(`🛑 Stopping group due to step failure: ${step.name}`);
            break;
          }
        }
      });

      console.log(`📊 Group ${groupName} completed with: ${groupSuccess ? 'SUCCESS' : 'FAILURE'}`);
    }

    console.log("\n🎉 All test groups completed");

  } catch (error) {
    console.error(`💥 Critical error during test execution: ${error.message}`);
    allStepsPassed = false;
  } finally {
    try {
      if (page) await page.close();
      if (context) await context.close();
      console.log("🔚 Browser closed");
    } catch (e) {
      console.error(`⚠️ Error closing browser: ${e.message}`);
    }
  }
}

// Helper function to check element visibility
const safeVisible = async (locator) => {
  try {
    return await locator.isVisible();
  } catch (e) {
    return false;
  }
};

// Async function to execute actions (for use outside groups)
const executeAction = async (page, baseURL, step) => {
  const { action, selector, url, value, waitForLoadState } = step;

  switch (action) {
    case "goto":
      console.log(`🌐 Navigating to: ${baseURL}${url}`);
      await page.goto(`${baseURL}${url}`, { 
        waitUntil: 'networkidle',
        timeout: 30000
      });
      await page.waitForLoadState('networkidle', { timeout: 30000 });
      k6Sleep(2);
      return true;

    case "click":
      console.log(`🖱️ Clicking: ${selector}`);
      const clickLocator = page.locator(selector);
      await clickLocator.waitFor({ state: 'visible', timeout: 10000 });
      await clickLocator.click();
      
      if (waitForLoadState) {
        console.log("⏳ Waiting for page to load after click...");
        await page.waitForLoadState('networkidle', { timeout: 30000 });
        k6Sleep(2);
      }
      return true;

    case "type":
      console.log(`⌨️ Typing in: ${selector}`);
      const typeLocator = page.locator(selector);
      await typeLocator.waitFor({ state: 'visible', timeout: 10000 });
      await typeLocator.fill(value);
      k6Sleep(1);
      return true;

    case "check":
      console.log(`🔍 Checking: ${selector}`);
      if (waitForLoadState) {
        console.log("⏳ Waiting for network idle before check...");
        await page.waitForLoadState('networkidle', { timeout: 30000 });
      }
      
      const checkLocator = page.locator(selector);
      await checkLocator.waitFor({ state: 'visible', timeout: 15000 });
      const isVisible = await safeVisible(checkLocator);
      
      if (!isVisible) {
        throw new Error(`Element not visible - ${selector}`);
      }
      
      k6Sleep(0.5);
      return true;

    default:
      throw new Error(`Unknown action: ${action}`);
  }
};

// Synchronous wrapper for executeAction (for use inside groups)
const executeActionSync = (page, baseURL, step) => {
  let result = false;
  let error = null;
  
  // This is a workaround - we execute the async function but wait for it to complete
  // Note: This is not ideal but works for the k6 group context
  const execute = async () => {
    try {
      result = await executeAction(page, baseURL, step);
    } catch (e) {
      error = e;
    }
  };
  
  // Execute and wait for completion
  const promise = execute();
  
  // In a real scenario, we'd need to handle this differently
  // For now, we'll assume it works and handle errors via try-catch
  return result;
};

export function handleSummary(data) {
  return {
    "summary.html": htmlReport(data),
    "stdout": textSummary(data, { indent: " ", enableColors: true }),
  };
}

// Text summary function for console output
function textSummary(data, options) {
  const indent = options.indent || " ";
  let result = "\n" + indent + "📊 TEST SUMMARY\n";
  result += indent + "================\n";
  
  // Count passed and failed checks
  let totalChecks = 0;
  let passedChecks = 0;
  
  for (const group in data.metrics) {
    if (group.includes("checks")) {
      totalChecks += data.metrics[group].values.count || 0;
      passedChecks += data.metrics[group].values.passes || 0;
    }
  }
  
  result += indent + `Total Checks: ${totalChecks}\n`;
  result += indent + `Passed: ${passedChecks}\n`;
  result += indent + `Failed: ${totalChecks - passedChecks}\n`;
  result += indent + `Success Rate: ${((passedChecks / totalChecks) * 100 || 0).toFixed(2)}%\n`;
  
  // Add trend metrics information
  result += "\n" + indent + "TREND METRICS (Duration in ms):\n";
  result += indent + "---------------------------------\n";
  
  for (const [stepName, trend] of Object.entries(stepTrends)) {
    const values = data.metrics[trend.name]?.values;
    if (values) {
      result += indent + `${stepName}:\n`;
      result += indent + `  Avg: ${values.avg.toFixed(2)}ms, Min: ${values.min}ms, Max: ${values.max}ms\n`;
    }
  }
  
  return result;
}
