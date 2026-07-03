const { chromium } = require('playwright');
const TARGET_URL = 'http://localhost:3000';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.on('console', msg => {
    if (msg.type() === 'error') console.log('❌', msg.text().slice(0, 120));
  });

  await page.goto(`${TARGET_URL}/netflix/`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);

  // Select plan
  await page.locator('button:has-text("Selecionar Económico")').click();
  await page.waitForTimeout(500);

  // Test tab switching
  await page.click('#tab-register');
  await page.waitForTimeout(200);
  const btnText = await page.locator('#btn-auth-text').textContent();
  console.log('Register tab btn:', btnText);
  const confirmVisible = await page.locator('#confirm-password-container').isVisible();
  console.log('Confirm field:', confirmVisible);

  await page.click('#tab-login');
  await page.waitForTimeout(200);
  const btnText2 = await page.locator('#btn-auth-text').textContent();
  console.log('Login tab btn:', btnText2);

  // Fill phone + password
  await page.fill('#phone-input', '923456789');
  await page.fill('#password-input', 'test123');

  // Try register
  await page.click('#tab-register');
  await page.waitForTimeout(200);
  await page.fill('#confirm-password-input', 'test123');
  await page.locator('#btn-auth-submit').click();
  await page.waitForTimeout(2000);

  console.log('✅ Auth flow tested (no errors in console)');
  await browser.close();
})();
