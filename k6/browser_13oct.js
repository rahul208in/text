import { browser } from 'k6/browser';
import { check, group } from 'k6';
import { htmlReport } from './bundle.js';

// Sample JSON configuration - This would come from user input
const userConfig = {
  "baseUrl": "https://www.hackerrank.com",
  "groups": [
    {
      "group": "Main Page Navigation",
      "steps": [
        {
          "name": "Navigate to main page",
          "action": "goto",
          "url": "/",
          "screenshot": true
        },
        {
          "name": "Check main page heading",
          "action": "check",
          "selector": "xpath=/html/body/div[2]/div/div/div/div/h1/span[2]",
          "screenshot": false
        },
        {
          "name": "Click Get Started button",
          "action": "click",
          "selector": "xpath=/html/body/div[2]/div/div/div/div/div/a[1]",
          "screenshot": true,
          "checks": [
            {
              "description": "Signup form should appear",
              "selector": "xpath=//*[@id='skip-nav-main']/div/div/div[2]/form/div/div[1]/div[1]",
              "screenshot": true
            }
          ]
        }
      ]
    },
    {
      "group": "Interview 2", 
      "steps": [
        {
          "name": "Navigate to main page",
          "action": "goto",
          "url": "/",
          "screenshot": false
        },
        {
          "name": "Check main page heading",
          "action": "check", 
          "selector": "xpath=/html/body/div[2]/div/div/div/div/h1/span[2]",
          "screenshot": true
        },
        {
          "name": "hover to product",
          "action": "hover",
          "selector": "xpath=//*[@id=\"LandingHeaderNav\"]/div[1]/div[1]/div/div[1]/div[1]",
          "screenshot": false,
        },
        {
          "name": "Click on Interview link",
          "action": "click",
          "selector": "xpath=//*[@id=\"LandingHeaderNav\"]/div[1]/div[1]/div/div[1]/div[2]/div[1]/a[2]/div[1]/div[2]",
          "screenshot": false,
          "checks": [
            {
              "description": "Interview page should load",
              "selector": "xpath=/html/body/section[1]/div[1]/div/div/div[1]/div[1]/h1",
              "screenshot": true
            }
          ]
        }
      ]
    }
  ]
};

export const options = {
  scenarios: {
    ui: {
      executor: 'constant-vus',
      vus: 1,
      duration: '1m', 
      options: {
        browser: { type: 'chromium', headless: false }
      }
    }
  },
  thresholds: {}
};

// Global counters for autonumbering
let groupCounter = 0;
let stepCounter = 0;
let currentGroupName = null;
let page = null;
let context = null;

// Helper function to safely check element visibility
const safeVisible = async (locator) => {
  try {
    if (!locator) return false;
    await locator.waitFor({ state: 'visible', timeout: 15000 });
    return true;
  } catch (error) {
    console.log(`Element not visible: ${error.message}`);
    return false;
  }
};

// Helper: record a visibility check
const performCheck = (label, isVisible) => {
  const labelString = typeof label === 'string' && label.trim() ? label : 'Unnamed Check';
  
  check(null, { [labelString]: () => isVisible });

  if (isVisible) {
    console.log(`✓ ${labelString}`);
  } else {
    console.error(`✗ ${labelString}`);
  }
  
  return isVisible;
};

// Helper function to run steps with auto-numbering and conditional screenshots
const runStep = async (stepName, stepFunction, takeScreenshot = false) => {
  stepCounter++;
  const stepNumber = stepCounter.toString().padStart(2, '0');
  
  try {
    console.log(`\n📝 Step ${stepNumber}: ${stepName}`);
    const result = await stepFunction();
    
    // Take screenshot after each step ONLY if user requested it
    if (takeScreenshot && page) {
      const screenshotName = `${currentGroupName}_${stepNumber}_${stepName.replace(/[^a-zA-Z0-9]/g, '_')}.png`;
      try {
        await page.screenshot({ path: `screenshots/${screenshotName}`, fullPage: true });
        console.log(`📸 Screenshot saved: ${screenshotName}`);
      } catch (screenshotError) {
        console.log(`❌ Could not take screenshot: ${screenshotError.message}`);
      }
    }
    
    return result;
  } catch (error) {
    console.error(`❌ Failed step "${stepName}": ${error.message}`);
    
    // Take screenshot on failure ONLY if user requested it
    if (takeScreenshot && page) {
      const screenshotName = `ERROR_${currentGroupName}_${stepNumber}_${stepName.replace(/[^a-zA-Z0-9]/g, '_')}.png`;
      try {
        await page.screenshot({ path: `screenshots/${screenshotName}`, fullPage: true });
        console.log(`📸 Error screenshot saved: ${screenshotName}`);
      } catch (screenshotError) {
        console.log(`❌ Could not take error screenshot: ${screenshotError.message}`);
      }
    }
    
    return false;
  }
};

// Function to execute actions based on user configuration
const executeAction = async (stepConfig) => {
  const { action, selector, url, value } = stepConfig;
  
  switch (action) {
    case 'goto':
      await page.goto(userConfig.baseUrl + url, { 
        waitUntil: 'networkidle',
        timeout: 30000 
      });
      await page.waitForTimeout(2000);
      return true;
      
    case 'click':
      const clickLocator = page.locator(selector);
      await clickLocator.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);
      return true;
      
    case 'hover':
      const hoverLocator = page.locator(selector);
      await hoverLocator.hover();
      await page.waitForTimeout(1000);
      return true;
      
    case 'check':
      const checkLocator = page.locator(selector);
      const isVisible = await safeVisible(checkLocator);
      return isVisible;
      
    case 'type':
      const typeLocator = page.locator(selector);
      await typeLocator.fill(value);
      await page.waitForTimeout(1000);
      return true;
      
    case 'doubleClick':
      const doubleClickLocator = page.locator(selector);
      await doubleClickLocator.dblclick();
      await page.waitForTimeout(1000);
      return true;
      
    case 'rightClick':
      const rightClickLocator = page.locator(selector);
      await rightClickLocator.click({ button: 'right' });
      await page.waitForTimeout(1000);
      return true;
      
    case 'pressKey':
      await page.keyboard.press(value); // value would be like 'Enter', 'Escape'
      await page.waitForTimeout(500);
      return true;
      
    case 'scroll':
      const scrollLocator = page.locator(selector);
      await scrollLocator.scrollIntoViewIfNeeded();
      await page.waitForTimeout(1000);
      return true;
      
    case 'selectOption':
      const selectLocator = page.locator(selector);
      await selectLocator.selectOption(value);
      await page.waitForTimeout(1000);
      return true;
      
    case 'wait':
      await page.waitForTimeout(value); // value in milliseconds
      return true;
      
    default:
      console.error(`Unknown action: ${action}`);
      return false;
  }
};

// Function to execute a complete test group from user config
const executeTestGroupFromConfig = async (groupConfig) => {
  groupCounter++;
  stepCounter = 0;
  currentGroupName = groupConfig.group.replace(/[^a-zA-Z0-9]/g, '_');
  
  console.log(`\n🎯 GROUP ${groupCounter.toString().padStart(2, '0')}: ${groupConfig.group}`);
  
  let allStepsPassed = true;
  const stepResults = [];
  
  for (const stepConfig of groupConfig.steps) {
    const stepPassed = await runStep(
      stepConfig.name, 
      async () => {
        // Execute main action
        const actionResult = await executeAction(stepConfig);
        
        // Execute additional checks if any
        if (stepConfig.checks && stepConfig.checks.length > 0) {
          for (const checkConfig of stepConfig.checks) {
            const checkLocator = page.locator(checkConfig.selector);
            const checkVisible = await safeVisible(checkLocator);
            
            // Take screenshot for check if requested
            if (checkConfig.screenshot && page) {
              const checkScreenshotName = `${currentGroupName}_${stepCounter.toString().padStart(2, '0')}_${stepConfig.name.replace(/[^a-zA-Z0-9]/g, '_')}_check.png`;
              try {
                await page.screenshot({ path: `screenshots/${checkScreenshotName}`, fullPage: true });
                console.log(`📸 Check screenshot saved: ${checkScreenshotName}`);
              } catch (screenshotError) {
                console.log(`❌ Could not take check screenshot: ${screenshotError.message}`);
              }
            }
            
            if (!checkVisible) {
              return false;
            }
          }
        }
        
        return actionResult;
      },
      stepConfig.screenshot // Pass screenshot preference from user config
    );
    
    stepResults.push({ name: stepConfig.name, passed: stepPassed });
    if (!stepPassed) {
      allStepsPassed = false;
    }
  }
  
  // Record checks in group
  group(groupConfig.group, () => {
    stepResults.forEach((result, index) => {
      const checkLabel = `Step ${(index + 1).toString().padStart(2, '0')}: ${result.name}`;
      performCheck(checkLabel, result.passed);
    });
  });
  
  return allStepsPassed;
};

export default async function () {
  try {
    console.log('🚀 Launching browser...');
    context = await browser.newContext({ 
      viewport: { width: 1280, height: 800 },
      ignoreHTTPSErrors: true
    });
    
    page = await context.newPage();
    page.setDefaultTimeout(30000);
    page.setDefaultNavigationTimeout(30000);

    // Execute all groups from user configuration
    for (const groupConfig of userConfig.groups) {
      await executeTestGroupFromConfig(groupConfig);
    }

    console.log('\n✅ All test groups completed');

  } catch (err) {
    console.error("❌ Critical error during test execution: " + err.message);
  } finally {
    try {
      if (page) {
        console.log("Closing page...");
        await page.close();
      }
    } catch (e) {
      console.error("Error closing page: " + (e?.message || e));
    }
    
    try {
      if (context) {
        console.log("Closing browser context...");
        await context.close();
      }
    } catch (e) {
      console.error("Error closing context: " + (e?.message || e));
    }
  }
}

export function handleSummary(data) {
  return {
    'summary.html': htmlReport(data),
    'summary.json': JSON.stringify(data),
  };
}
