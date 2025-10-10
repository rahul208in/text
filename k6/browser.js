import { browser } from 'k6/browser';
import { check, group } from 'k6';
import { htmlReport } from './bundle.js';

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
  thresholds: {},
};

export default async function () {
  let context;
  let page;

  const baseURL = 'https://example.com';
  let currentGroupName = null; // Track current group for all steps

  // Helper: run step and return success/failure boolean
  const runStep = async (label, fn) => {
    console.log(`▶️  ${label}`);
    let ok = false;
    try {
      await fn();
      console.log(`✅ ${label}`);
      ok = true;
    } catch (err) {
      console.error(`❌ ${label} - ${err?.message || err}`);
      ok = false;
    }
    // Record this step as a check under the current group
    if (currentGroupName) {
      group(currentGroupName, () => {
        check(null, { [label]: () => ok });
      });
    }
    return ok;
  };

  // Helper: safe visibility check
  const safeVisible = async (locator) => {
    try {
      return await locator.isVisible();
    } catch (_e) {
      return false;
    }
  };

  // Helper: record a visibility check under current group
  const checkVisible = async (label, locator) => {
    const visible = await safeVisible(locator);
    if (currentGroupName) {
      group(currentGroupName, () => {
        check(null, { [label]: () => visible });
      });
    }
    if (visible) {
      console.log(`   ✓ ${label}`);
    } else {
      console.error(`   ✗ ${label}`);
    }
    return visible;
  };

  try {
    console.log('🚀 Launching browser...');
    context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    page = await context.newPage();

    // ========== GROUP 1: Login Flow ==========
    currentGroupName = 'Login Flow';
    console.log(`\n📦 GROUP: ${currentGroupName}`);

    await runStep('Navigate to base URL', async () => {
      await page.goto(baseURL, { waitUntil: 'networkidle' });
    });

    await runStep('Go to login page', async () => {
      await page.goto(`${baseURL}/login`, { waitUntil: 'networkidle' });
    });

    await checkVisible('Login page title is visible', page.locator('xpath=//h1[contains(text(), "Login")]'));

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

    await checkVisible('Welcome message is visible', page.locator('xpath=//div[contains(text(), "Welcome")]'));

    await runStep('Screenshot after login', async () => {
      await page.screenshot({ path: 'screenshots/02_dashboard.png' });
    });

    // ========== GROUP 2: Product Search ==========
    currentGroupName = 'Product Search';
    console.log(`\n📦 GROUP: ${currentGroupName}`);

    await runStep('Navigate to base URL', async () => {
      await page.goto(baseURL, { waitUntil: 'networkidle' });
    });

    await runStep('Open products page', async () => {
      await page.goto(`${baseURL}/products`, { waitUntil: 'networkidle' });
    });

    await checkVisible('Products page header is visible', page.locator('xpath=//h2[contains(text(), "Products")]'));

    await runStep('Screenshot products page', async () => {
      await page.screenshot({ path: 'screenshots/03_products_page.png' });
    });

    await runStep('Open first product', async () => {
      await page.locator('xpath=(//div[@class="product-card"])[1]').click();
      await page.waitForLoadState('networkidle');
    });

    await checkVisible('Add to Cart button is visible', page.locator('xpath=//button[contains(text(), "Add to Cart")]'));

    await runStep('Screenshot product detail', async () => {
      await page.screenshot({ path: 'screenshots/04_product_detail.png' });
    });

    // ========== GROUP 3: Add Product to Cart ==========
    currentGroupName = 'Add Product to Cart';
    console.log(`\n📦 GROUP: ${currentGroupName}`);

    await runStep('Click Add to Cart', async () => {
      await page.locator('xpath=//button[contains(text(), "Add to Cart")]').click();
      await page.waitForTimeout(800);
    });

    await checkVisible('Success message is visible', page.locator('xpath=//div[contains(text(), "Added to cart")]'));

    await runStep('Screenshot after add to cart', async () => {
      await page.screenshot({ path: 'screenshots/05_added_to_cart.png' });
    });

    // ========== GROUP 4: View Shopping Cart ==========
    currentGroupName = 'View Shopping Cart';
    console.log(`\n📦 GROUP: ${currentGroupName}`);

    await runStep('Navigate to base URL', async () => {
      await page.goto(baseURL, { waitUntil: 'networkidle' });
    });

    await runStep('Open cart page', async () => {
      await page.goto(`${baseURL}/cart`, { waitUntil: 'networkidle' });
    });

    await checkVisible('Cart page header is visible', page.locator('xpath=//h1[contains(text(), "Shopping Cart")]'));

    await runStep('Screenshot cart page', async () => {
      await page.screenshot({ path: 'screenshots/06_cart_page.png' });
    });

    await checkVisible('Cart items are visible', page.locator('xpath=//div[@class="cart-item"]'));

    await runStep('Final screenshot', async () => {
      await page.screenshot({ path: 'screenshots/07_final_cart.png' });
    });

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
    'summary.html': htmlReport(data),
    'summary.json': JSON.stringify(data),
  };
}
