import { browser } from 'k6/browser';
import { check, group, sleep as k6Sleep } from 'k6';
import { Trend } from 'k6/metrics';
import { htmlReport } from "https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js";

// Create trend metrics for each step
const stepTrends = {};
export const options = {
  scenarios: {
    ui: {
      executor: "shared-iterations",
      vus: 1,
      iterations: 1,
      options: {
        browser: {
          type: "chromium",
          headless: true,
        },
      },
    },
  },
  thresholds: {},
};
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



// Initialize trends for all steps
userConfig.transactions.forEach(transaction => {
  transaction.steps.forEach(step => {
    const trendName = `${step.name.replace(/[^a-zA-Z0-9]/g, '_')}_${step.action}`;
    stepTrends[step.name] = new Trend(trendName, true);
  });
});

export default async function () {
  const baseURL = userConfig.baseUrl;
  const page = await browser.newPage();
  
  try {
    console.log("> Launching browser...");
    await page.setViewportSize({ width: 1280, height: 800 });
    page.setDefaultTimeout(30000);
    page.setDefaultNavigationTimeout(30000);

    let allStepsPassed = true;

    // Execute all test groups
    for (const transaction of userConfig.transactions) {
      const groupName = transaction.name;
      let groupSuccess = true;
      
      console.log(`\n🎯 GROUP: ${groupName}`);
      
      // Execute steps and collect results
      const stepResults = [];
      
      for (let i = 0; i < transaction.steps.length; i++) {
        const step = transaction.steps[i];

        const startTime = Date.now();
        let stepSuccess = false;
        let errorMessage = '';

        try {
          // Execute the step action with await
          await executeAction(page, baseURL, step);
          stepSuccess = true;
          console.log(`✅ PASS: ${step.name}`);
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

        // Take screenshot if requested (take on both success and failure for debugging)
        if (step.screenshot) {
          try {
            const screenshotName = `${groupName.replace(/[^a-zA-Z0-9]/g, '_')}_${step.name.replace(/[^a-zA-Z0-9]/g, '_')}_${stepSuccess ? 'PASS' : 'FAIL'}.png`;
            await page.screenshot({ path: `${screenshotName}` });
            console.log(`📸 Screenshot: ${screenshotName}`);
          } catch (e) {
            console.log(`⚠️  Could not take screenshot: ${e.message}`);
          }
        }

        // Store result for group check
        stepResults.push({
          name: step.name,
          success: stepSuccess,
          skipped: false
        });

        // Continue to next step regardless of failure
      }

      // Now register all checks within a group (synchronous)
      group(groupName, () => {
        stepResults.forEach(result => {
          check(null, {
            [result.name]: () => result.success
          });
        });
      });

      console.log(`📊 Group ${groupName} completed with: ${groupSuccess ? 'SUCCESS' : 'FAILURE'}`);
    }

    console.log("\n🎉 All test groups completed");

  } catch (error) {
    console.error(`💥 Critical error during test execution: ${error.message}`);
  } finally {
    try {
      await page.close();
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

// Async function to execute actions
const executeAction = async (page, baseURL, step) => {
  const { action, selector, url, value, waitForLoadState } = step;

  switch (action) {
    case "goto":
      console.log(`🌐 Navigating to: ${baseURL}${url}`);
      await page.goto(`${baseURL}${url}`, { 
        waitUntil: 'networkidle',
        timeout: 30000
      });
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

export function handleSummary(data) {
  return {
    "summary.html": htmlReport(data),
    "summary.json": JSON.stringify(data),

  };
}
