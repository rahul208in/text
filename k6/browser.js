import { browser } from 'k6/browser';
import { check, group } from 'k6';
import { htmlReport } from './bundle.js';

export const options = {
  scenarios: {
    ui: {
      executor: 'shared-iterations',
      vus: 1,
      iterations: 1,
      options: { browser: { type: 'chromium', headless: false } },
    },
  },
  thresholds: {},
};

export default async function () {
  let context;
  let page;

  const baseURL = 'https://example.com';

  // Keep your flow helpers as-is (example implementations shown)
  const runStep = async (label, fn) => {
    console.log(`▶️ ${label}`);
    try {
      await fn();
      console.log(`✅ ${label}`);
    } catch (err) {
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

  // Critical fix: execute check() inside a sync group callback
  const recordCheckInGroup = (groupName, name, ok) => {
    group(groupName, () => {
      check(null, { [name]: () => ok });
    });
  };

  try {
    context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    page = await context.newPage();

    // Group 1 flow
    await (async () => {
      await runStep('Navigate to base URL', async () => {
        await page.goto(baseURL, { waitUntil: 'networkidle' });
      });

      await runStep('Go to login page', async () => {
        await page.goto(`${baseURL}/login`, { waitUntil: 'networkidle' });
      });

      {
        const ok = await safeVisible(page.locator('xpath=//h1[contains(text(), "Login")]'));
        recordCheckInGroup('Group 1', 'Login page title is visible', ok);
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
        recordCheckInGroup('Group 1', 'Welcome message is visible', ok);
      }

      await runStep('Screenshot after login', async () => {
        await page.screenshot({ path: 'screenshots/02_dashboard.png' });
      });
    })();

    // Group 2 flow
    await (async () => {
      await runStep('Navigate to base URL', async () => {
        await page.goto(baseURL, { waitUntil: 'networkidle' });
      });

      await runStep('Open products page', async () => {
        await page.goto(`${baseURL}/products`, { waitUntil: 'networkidle' });
      });

      {
        const ok = await safeVisible(page.locator('xpath=//h2[contains(text(), "Products")]'));
        recordCheckInGroup('Group 2', 'Products page header is visible', ok);
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
        recordCheckInGroup('Group 2', 'Add to Cart button is visible', ok);
      }

      await runStep('Screenshot product detail', async () => {
        await page.screenshot({ path: 'screenshots/04_product_detail.png' });
      });
    })();

    // Continue with more groups/flows in the same pattern...
  } catch (err) {
    console.error('❌ Critical error during test execution:', err);
  } finally {
    try { if (page?.close) await page.close(); } catch {}
    try { if (context?.close) await context.close(); } catch {}
  }
}

export function handleSummary(data) {
  return { 'summary.html': htmlReport(data) };
}
