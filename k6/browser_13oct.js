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
  const { action, selector, url, value, waitForLoadState, text, key, option, x, y, button, clickCount, delay } = step;

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
      await clickLocator.click({
        button: button || 'left', // 'left', 'right', 'middle'
        clickCount: clickCount || 1,
        delay: delay || 0
      });
      
      if (waitForLoadState) {
        console.log("⏳ Waiting for page to load after click...");
        await page.waitForLoadState('networkidle', { timeout: 30000 });
        k6Sleep(2);
      }
      return true;

    case "doubleClick":
      console.log(`🖱️🖱️ Double clicking: ${selector}`);
      const dblClickLocator = page.locator(selector);
      await dblClickLocator.waitFor({ state: 'visible', timeout: 10000 });
      await dblClickLocator.dblclick();
      k6Sleep(1);
      return true;

    case "rightClick":
      console.log(`🖱️ Right clicking: ${selector}`);
      const rightClickLocator = page.locator(selector);
      await rightClickLocator.waitFor({ state: 'visible', timeout: 10000 });
      await rightClickLocator.click({ button: 'right' });
      k6Sleep(1);
      return true;

    case "hover":
      console.log(`👆 Hovering over: ${selector}`);
      const hoverLocator = page.locator(selector);
      await hoverLocator.waitFor({ state: 'visible', timeout: 10000 });
      await hoverLocator.hover();
      k6Sleep(1);
      return true;

    case "type":
      console.log(`⌨️ Typing in: ${selector}`);
      const typeLocator = page.locator(selector);
      await typeLocator.waitFor({ state: 'visible', timeout: 10000 });
      await typeLocator.fill(value);
      k6Sleep(1);
      return true;

    case "press":
      console.log(`⌨️ Pressing key: ${key} ${selector ? 'on ' + selector : 'on page'}`);
      if (selector) {
        const pressLocator = page.locator(selector);
        await pressLocator.waitFor({ state: 'visible', timeout: 10000 });
        await pressLocator.press(key); // e.g., 'Enter', 'Tab', 'Escape'
      } else {
        await page.keyboard.press(key);
      }
      k6Sleep(0.5);
      return true;

    case "clear":
      console.log(`🧹 Clearing: ${selector}`);
      const clearLocator = page.locator(selector);
      await clearLocator.waitFor({ state: 'visible', timeout: 10000 });
      await clearLocator.clear();
      k6Sleep(0.5);
      return true;

    case "select":
      console.log(`📋 Selecting option in: ${selector}`);
      const selectLocator = page.locator(selector);
      await selectLocator.waitFor({ state: 'visible', timeout: 10000 });
      if (value) {
        await selectLocator.selectOption({ value: value });
      } else if (text) {
        await selectLocator.selectOption({ label: text });
      } else if (option) {
        await selectLocator.selectOption(option);
      }
      k6Sleep(0.5);
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

    case "checkText":
      console.log(`🔍 Checking text "${text}" in: ${selector}`);
      const textLocator = page.locator(selector);
      await textLocator.waitFor({ state: 'visible', timeout: 10000 });
      const elementText = await textLocator.textContent();
      
      if (!elementText || !elementText.includes(text)) {
        throw new Error(`Text "${text}" not found in element - ${selector}`);
      }
      
      k6Sleep(0.5);
      return true;

    case "checkValue":
      console.log(`🔍 Checking value "${value}" in: ${selector}`);
      const valueLocator = page.locator(selector);
      await valueLocator.waitFor({ state: 'visible', timeout: 10000 });
      const elementValue = await valueLocator.inputValue();
      
      if (elementValue !== value) {
        throw new Error(`Expected value "${value}" but got "${elementValue}" in - ${selector}`);
      }
      
      k6Sleep(0.5);
      return true;

    case "checkAttribute":
      console.log(`🔍 Checking attribute "${step.attribute}" in: ${selector}`);
      const attrLocator = page.locator(selector);
      await attrLocator.waitFor({ state: 'visible', timeout: 10000 });
      const attrValue = await attrLocator.getAttribute(step.attribute);
      
      if (value && attrValue !== value) {
        throw new Error(`Expected attribute "${step.attribute}" to be "${value}" but got "${attrValue}" in - ${selector}`);
      } else if (!attrValue) {
        throw new Error(`Attribute "${step.attribute}" not found in - ${selector}`);
      }
      
      k6Sleep(0.5);
      return true;

    case "checkEnabled":
      console.log(`🔍 Checking if enabled: ${selector}`);
      const enabledLocator = page.locator(selector);
      await enabledLocator.waitFor({ state: 'visible', timeout: 10000 });
      const isEnabled = await enabledLocator.isEnabled();
      
      if (!isEnabled) {
        throw new Error(`Element is disabled - ${selector}`);
      }
      
      k6Sleep(0.5);
      return true;

    case "checkDisabled":
      console.log(`🔍 Checking if disabled: ${selector}`);
      const disabledLocator = page.locator(selector);
      await disabledLocator.waitFor({ state: 'visible', timeout: 10000 });
      const isDisabled = await disabledLocator.isDisabled();
      
      if (!isDisabled) {
        throw new Error(`Element is not disabled - ${selector}`);
      }
      
      k6Sleep(0.5);
      return true;

    case "checkChecked":
      console.log(`🔍 Checking if checkbox/radio is checked: ${selector}`);
      const checkedLocator = page.locator(selector);
      await checkedLocator.waitFor({ state: 'visible', timeout: 10000 });
      const isChecked = await checkedLocator.isChecked();
      
      if (!isChecked) {
        throw new Error(`Element is not checked - ${selector}`);
      }
      
      k6Sleep(0.5);
      return true;

    case "checkCount":
      console.log(`🔍 Checking element count for: ${selector}`);
      const countLocator = page.locator(selector);
      const count = await countLocator.count();
      const expectedCount = step.count || 1;
      
      if (count !== expectedCount) {
        throw new Error(`Expected ${expectedCount} elements but found ${count} - ${selector}`);
      }
      
      k6Sleep(0.5);
      return true;

    case "scrollTo":
      console.log(`📜 Scrolling to: ${selector || 'position'}`);
      if (selector) {
        const scrollLocator = page.locator(selector);
        await scrollLocator.waitFor({ state: 'visible', timeout: 10000 });
        await scrollLocator.scrollIntoViewIfNeeded();
      } else if (x !== undefined && y !== undefined) {
        await page.evaluate(({ x, y }) => window.scrollTo(x, y), { x, y });
      }
      k6Sleep(1);
      return true;

    case "focus":
      console.log(`🎯 Focusing on: ${selector}`);
      const focusLocator = page.locator(selector);
      await focusLocator.waitFor({ state: 'visible', timeout: 10000 });
      await focusLocator.focus();
      k6Sleep(0.5);
      return true;

    case "blur":
      console.log(`👋 Blurring: ${selector}`);
      const blurLocator = page.locator(selector);
      await blurLocator.waitFor({ state: 'visible', timeout: 10000 });
      await blurLocator.blur();
      k6Sleep(0.5);
      return true;

    case "uploadFile":
      console.log(`📤 Uploading file to: ${selector}`);
      const uploadLocator = page.locator(selector);
      await uploadLocator.waitFor({ state: 'visible', timeout: 10000 });
      await uploadLocator.setInputFiles(step.filePath); // filePath can be string or array
      k6Sleep(1);
      return true;

    case "dragAndDrop":
      console.log(`🔀 Dragging from ${selector} to ${step.targetSelector}`);
      const sourceLocator = page.locator(selector);
      const targetLocator = page.locator(step.targetSelector);
      await sourceLocator.waitFor({ state: 'visible', timeout: 10000 });
      await targetLocator.waitFor({ state: 'visible', timeout: 10000 });
      await sourceLocator.dragTo(targetLocator);
      k6Sleep(1);
      return true;

    case "wait":
      console.log(`⏱️ Waiting for ${step.timeout || 1000}ms`);
      k6Sleep((step.timeout || 1000) / 1000);
      return true;

    case "waitForSelector":
      console.log(`⏳ Waiting for selector: ${selector}`);
      const waitLocator = page.locator(selector);
      await waitLocator.waitFor({ 
        state: step.state || 'visible', 
        timeout: step.timeout || 10000 
      });
      k6Sleep(0.5);
      return true;

    case "reload":
      console.log(`🔄 Reloading page`);
      await page.reload({ waitUntil: 'networkidle', timeout: 30000 });
      k6Sleep(2);
      return true;

    case "goBack":
      console.log(`⬅️ Going back`);
      await page.goBack({ waitUntil: 'networkidle', timeout: 30000 });
      k6Sleep(2);
      return true;

    case "goForward":
      console.log(`➡️ Going forward`);
      await page.goForward({ waitUntil: 'networkidle', timeout: 30000 });
      k6Sleep(2);
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
