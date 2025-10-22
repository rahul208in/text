import { browser } from 'k6/browser';
import { check, group } from 'k6';
import { Trend } from 'k6/metrics';

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
      
      await group(groupName, async () => {
        for (const step of transaction.steps) {
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
            // Execute the step action
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

          // Take screenshot if requested and step failed
          if ((step.screenshot && !stepSuccess) || (step.screenshot && stepSuccess)) {
            try {
              const screenshotName = `${groupName}_${step.name.replace(/[^a-zA-Z0-9]/g, '_')}.png`;
              await page.screenshot({ path: `screenshots/${screenshotName}` });
              console.log(`📸 Screenshot: ${screenshotName}`);
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

// Function to execute actions with proper waiting
const executeAction = async (page, baseURL, step) => {
  const { action, selector, url, value, waitForLoadState } = step;

  switch (action) {
    case "goto":
      console.log(`🌐 Navigating to: ${baseURL}${url}`);
      await page.goto(`${baseURL}${url}`, { 
        waitUntil: 'networkidle',
        timeout: 30000
      });
      // Additional wait for complete page load
      await page.waitForLoadState('networkidle', { timeout: 30000 });
      await page.waitForTimeout(2000); // Small delay for dynamic content
      break;

    case "click":
      console.log(`🖱️ Clicking: ${selector}`);
      const clickLocator = page.locator(selector);
      await clickLocator.waitFor({ state: 'visible', timeout: 10000 });
      await clickLocator.click();
      
      if (waitForLoadState) {
        console.log("⏳ Waiting for page to load after click...");
        await page.waitForLoadState('networkidle', { timeout: 30000 });
        await page.waitForTimeout(2000); // Additional stabilization
      }
      break;

    case "type":
      console.log(`⌨️ Typing in: ${selector}`);
      const typeLocator = page.locator(selector);
      await typeLocator.waitFor({ state: 'visible', timeout: 10000 });
      await typeLocator.fill(value);
      await page.waitForTimeout(1000); // Small delay after typing
      break;

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
      break;

    default:
      throw new Error(`Unknown action: ${action}`);
  }
};
