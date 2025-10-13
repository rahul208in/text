import { browser } from 'k6/browser';
import { check, group } from 'k6';
import { htmlReport } from './bundle.js';

// Configuration injected from browser.json
const userConfig = {
  "baseUrl": "https://www.hackerrank.com",
  "transactions": [
    {
      "name": "Main Page Navigation",
      "steps": [
        {
          "name": "Navigate to main page",
          "action": "goto",
          "url": "/",
          "screenshot": true
        },
        {
          "name": "Check main page heading is visible",
          "action": "check",
          "selector": "xpath=/html/body/div[2]/div/div/div/div/h1/span[2]",
          "screenshot": false
        },
        {
          "name": "Click Get Started button",
          "action": "click",
          "selector": "xpath=/html/body/div[2]/div/div/div/div/div/a[1]",
          "screenshot": true,
          "waitForLoadState": true
        },
        {
          "name": "Check signup form appeared after click",
          "action": "check",
          "selector": "xpath=//*[@id='skip-nav-main']/div/div/div[2]/form/div/div[1]/div[1]",
          "screenshot": true
        },
                {
          "name": "firstname",
          "action": "type",
          "value" : "hello",
          "selector": "xpath=//*[@id='first_name']",
          "screenshot": false
        },
                {
          "name": "lastname",
          "value": "world",
          "action": "type",
          "selector": "xpath=//*[@id='last_name']",
          "screenshot": false
        }

      ]
    },
    
    
  ]
};

export const options = {
  scenarios: {
    ui: {
      executor: 'shared-iterations',
      vus: 1,
      iterations: 1,
      options: {
        browser: { type: 'chromium', headless: false }
      }
    }
  },
  thresholds: {}
};

export default async function () {
  let context;
  let page;
  const baseURL = userConfig.baseUrl;
  let currentGroupName = null;
  let groupCounter = 0;
  let stepCounter = 0;

  // Helper: run step and return success/failure boolean
  const runStep = async (label, fn, takeScreenshot = false) => {
    stepCounter++;
    const stepNumber = stepCounter.toString().padStart(2, '0');
    const labelString = typeof label === 'string' && label.trim() !== '' ? label : 'Unnamed Step';
    
    console.log(`> Step ${stepNumber}: ${labelString}`);
    let ok = false;
    
    try {
      await fn();
      console.log(`✓ ${labelString}`);
      ok = true;
    } catch (err) {
      console.error(`✗ ${labelString}: ${err?.message || err}`);
      ok = false;
    }

    // Take screenshot if requested
    if (takeScreenshot && page) {
      try {
        const screenshotName = `${currentGroupName}_${stepNumber}_${labelString.replace(/[^a-zA-Z0-9]/g, '_')}.png`;
        await page.screenshot({ path: `screenshots/${screenshotName}` });
        console.log(`📸 Screenshot: ${screenshotName}`);
      } catch (e) {
        console.log(`❌ Could not take screenshot: ${e.message}`);
      }
    }

    if (currentGroupName) {
      group(currentGroupName, () => {
        check(null, { [labelString]: () => ok });
      });
    }
    
    return ok;
  };

  // Helper: safe visibility check
  const safeVisible = async (locator) => {
    try {
      return await locator.isVisible();
    } catch (e) {
      return false;
    }
  };

  // Helper: record a visibility check under current group
  const checkVisible = async (label, locator) => {
    const labelString = typeof label === 'string' && label.trim() !== '' ? label : 'Unnamed Check';
    const visible = await safeVisible(locator);
    
    if (currentGroupName) {
      group(currentGroupName, () => {
        check(null, { [labelString]: () => visible });
      });
    }
    
    if (visible) {
      console.log(`✓ ${labelString}`);
    } else {
      console.error(`✗ ${labelString}`);
    }
    
    return visible;
  };

  // Function to execute actions
  const executeAction = async (step) => {
    const { action, selector, url, value } = step;
    
    switch (action) {
      case 'goto':
        await page.goto(baseURL + url, { waitUntil: 'networkidle' });
        await page.waitForTimeout(2000);
        return true;
        
      case 'click':
        const clickLocator = page.locator(selector);
        await clickLocator.click();
        if (step.waitForLoadState) {
          await page.waitForLoadState('networkidle');
        }
        await page.waitForTimeout(2000);
        return true;
        
      case 'hover':
        const hoverLocator = page.locator(selector);
        await hoverLocator.hover();
        await page.waitForTimeout(1000);
        if (step.waitForLoadState) {
          await page.waitForLoadState('networkidle');
        }
        return true;
        
      case 'type':
        const typeLocator = page.locator(selector);
        await typeLocator.fill(value);
        await page.waitForTimeout(1000);
        return true;
        
      case 'check':
        const checkLocator = page.locator(selector);
        const isVisible = await safeVisible(checkLocator);
        if (!isVisible) {
          throw new Error(`Check failed: Element not visible - ${selector}`);
        }
        return true;
        
      default:
        console.error(`Unknown action: ${action}`);
        return false;
    }
  };

  try {
    console.log('🚀 Launching browser...');
    context = await browser.newContext({ 
      viewport: { width: 1280, height: 800 },
      ignoreHTTPSErrors: true
    });
    
    page = await context.newPage();
    page.setDefaultTimeout(30000);
    page.setDefaultNavigationTimeout(30000);

    // Execute all test groups
    for (const transaction of userConfig.transactions) {
      groupCounter++;
      stepCounter = 0;
      currentGroupName = transaction.name;
      
      console.log(`\n🎯 GROUP ${groupCounter}: ${currentGroupName}`);
      
      for (const step of transaction.steps) {
        const stepPassed = await runStep(
          step.name,
          async () => {
            // Execute the action (check, click, type, hover, etc.)
            return await executeAction(step);
          },
          step.screenshot
        );
        
        if (!stepPassed) {
          console.error(`❌ Step failed, but continuing...`);
        }
      }
    }

    console.log('\n✅ All test groups completed');

  } catch (err) {
    console.error(`❌ Critical error during test execution: ${err.message}`);
  } finally {
    try {
      if (page) await page.close();
      if (context) await context.close();
    } catch (e) {
      console.error(`Error closing browser: ${e.message}`);
    }
  }
}

export function handleSummary(data) {
  return {
    'summary.html': htmlReport(data),
    'summary.json': JSON.stringify(data),
  };
}
