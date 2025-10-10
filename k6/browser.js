import { browser } from 'k6/browser';
import { check, group } from 'k6';
import { htmlReport } from './bundle.js';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.2/index.js';

export const options = {
  scenarios: {
    ui: {
      executor: 'shared-iterations',
      vus: 1,
      iterations: 1,
      options: {
        browser: { type: 'chromium', headless: false },
      },
    },
  },
  thresholds: {}, // we handle failures and keep going
};

export default async function () {
  let context;
  let page;

  const baseURL = 'https://example.com';

  const testResults = {
    totalSteps: 0,
    passedSteps: 0,
    failedSteps: 0,
    totalChecks: 0,
    passedChecks: 0,
    failedChecks: 0,
  };

  const runStep = async (label, fn) => {
    testResults.totalSteps++;
    console.log(`▶️  ${label}`);
    try {
      await fn();
      testResults.passedSteps++;
      console.log(`✅ ${label}`);
    } catch (err) {
      testResults.failedSteps++;
      console.error(`❌ ${label} - ${err?.message || err}`);
    }
  };

  const safeVisible = async (locator) => {
    try {
      return await locator.isVisible();
    } catch (_e) {
      return false;
    }
  };

  const recordCheckInGroup = (groupName, name, ok) => {
    testResults.totalChecks++;
    group(groupName, () => {
      const r = check(null, { [name]: () => ok });
      if (r) {
        testResults.passedChecks++;
        console.log(`   ✓ ${name}`);
      } else {
        testResults.failedChecks++;
        console.error(`   ✗ ${name}`);
      }
    });
  };

  try {
    console.log('🚀 Launching browser...');
    context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    page = await context.newPage();

    // GROUP 1: Login Flow
    console.log('\n📦 GROUP: Login Flow');

    await runStep('Navigate to base URL', async () => {
      await page.goto(baseURL, { waitUntil: 'networkidle' });
    });

    await runStep('Go to login page', async () => {
      await page.goto(`${baseURL}/login`, { waitUntil: 'networkidle' });
    });

    {
      // Compute, then record check inside group synchronously
      const ok = await safeVisible(page.locator('xpath=//h1[contains(text(), "Login")]'));
      recordCheckInGroup('Login Flow', 'Login page title is visible', ok);
    }

    await runStep('Screenshot login page', async () => {
      await page.screenshot({ path: 'screenshots/01_login_page.png' });
    });

    await runStep('Fill username', async () => {
      await page.locator('xpath=//input[@id="username"]').fill('testuser@example.com');
    });

    await runStep('Fill password', async () => {
      await page.locator('xpath=//input[@id="password"]').fill('SecurePass123');
    });

    await runStep('Click submit and wait', async () => {
      await page.locator('xpath=//button[@type="submit"]').click();
      await page.waitForLoadState('networkidle');
    });

    {
      const ok = await safeVisible(page.locator('xpath=//div[contains(text(), "Welcome")]'));
      recordCheckInGroup('Login Flow', 'Welcome message is visible', ok);
    }

    await runStep('Screenshot after login', async () => {
      await page.screenshot({ path: 'screenshots/02_dashboard.png' });
    });

    // GROUP 2: Product Search
    console.log('\n📦 GROUP: Product Search');

    await runStep('Navigate to base URL', async () => {
      await page.goto(baseURL, { waitUntil: 'networkidle' });
    });

    await runStep('Open products page', async () => {
      await page.goto(`${baseURL}/products`, { waitUntil: 'networkidle' });
    });

    {
      const ok = await safeVisible(page.locator('xpath=//h2[contains(text(), "Products")]'));
      recordCheckInGroup('Product Search', 'Products page header is visible', ok);
    }

    await runStep('Screenshot products page', async () => {
      await page.screenshot({ path: 'screenshots/03_products_page.png' });
    });

    await runStep('Open first product', async () => {
      await page.locator('xpath=(//div[@class="product-card"])[1]').click();
      await page.waitForLoadState('networkidle');
    });

    {
      const ok = await safeVisible(page.locator('xpath=//button[contains(text(), "Add to Cart")]'));
      recordCheckInGroup('Product Search', 'Add to Cart button is visible', ok);
    }

    await runStep('Screenshot product detail', async () => {
      await page.screenshot({ path: 'screenshots/04_product_detail.png' });
    });

    // GROUP 3: Add Product to Cart
    console.log('\n📦 GROUP: Add Product to Cart');

    await runStep('Click Add to Cart', async () => {
      await page.locator('xpath=//button[contains(text(), "Add to Cart")]').click();
      await page.waitForTimeout(800);
    });

    {
      const ok = await safeVisible(page.locator('xpath=//div[contains(text(), "Added to cart")]'));
      recordCheckInGroup('Add Product to Cart', 'Success message is visible', ok);
    }

    await runStep('Screenshot after add to cart', async () => {
      await page.screenshot({ path: 'screenshots/05_added_to_cart.png' });
    });

    // GROUP 4: View Shopping Cart
    console.log('\n📦 GROUP: View Shopping Cart');

    await runStep('Navigate to base URL', async () => {
      await page.goto(baseURL, { waitUntil: 'networkidle' });
    });

    await runStep('Open cart page', async () => {
      await page.goto(`${baseURL}/cart`, { waitUntil: 'networkidle' });
    });

    {
      const ok = await safeVisible(page.locator('xpath=//h1[contains(text(), "Shopping Cart")]'));
      recordCheckInGroup('View Shopping Cart', 'Cart page header is visible', ok);
    }

    await runStep('Screenshot cart page', async () => {
      await page.screenshot({ path: 'screenshots/06_cart_page.png' });
    });

    {
      const ok = await safeVisible(page.locator('xpath=//div[@class="cart-item"]'));
      recordCheckInGroup('View Shopping Cart', 'Cart items are visible', ok);
    }

    await runStep('Final screenshot', async () => {
      await page.screenshot({ path: 'screenshots/07_final_cart.png' });
    });

    // Summary
    console.log('\n📊 Test Summary:');
    console.log(`   Total Steps:   ${testResults.totalSteps}`);
    console.log(`   Passed Steps:  ${testResults.passedSteps}`);
    console.log(`   Failed Steps:  ${testResults.failedSteps}`);
    console.log(`   Total Checks:  ${testResults.totalChecks}`);
    console.log(`   Passed Checks: ${testResults.passedChecks}`);
    console.log(`   Failed Checks: ${testResults.failedChecks}`);
    const stepRate = (testResults.passedSteps / Math.max(1, testResults.totalSteps)) * 100;
    const checkRate = (testResults.passedChecks / Math.max(1, testResults.totalChecks)) * 100;
    console.log(`   Step Success Rate:  ${stepRate.toFixed(2)}%`);
    console.log(`   Check Success Rate: ${checkRate.toFixed(2)}%`);
  } catch (err) {
    console.error('❌ Critical error during test execution:', err);
  } finally {
    try {
      if (page && typeof page.close === 'function') {
        console.log('🧹 Closing page...');
        await page.close();
      }
    } catch (e) {
      console.error('Error closing page:', e?.message || e);
    }
    try {
      if (context && typeof context.close === 'function') {
        console.log('🧹 Closing browser context...');
        await context.close();
      }
    } catch (e) {
      console.error('Error closing context:', e?.message || e);
    }
  }
}

export function handleSummary(data) {
  return {
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
    'report.html': htmlReport(data, {
      title: 'Browser Test Report',
      inlineAssets: true,
    }),
    'summary.json': JSON.stringify(data),
  };
}
