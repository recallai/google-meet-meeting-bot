/* scripts/generate-auth.js
 * Generates auth.json without Playwright codegen UI.
*/

const { chromium } = require('playwright');
const path = require('path');
require('dotenv').config();

const {
  GOOGLE_ACCOUNT_USER,
  GOOGLE_ACCOUNT_PASSWORD,
} = process.env;

const LOGIN_URL =
  'https://accounts.google.com/ServiceLogin' +
  '?service=wise&passive=true&continue=https%3A%2F%2Fmeet.google.com%2F';

(async () => {
  console.log('Launching Chromium (headed) …');
  const browser  = await chromium.launch({ headless: false });
  const context  = await browser.newContext();
  const page     = await context.newPage();

  console.log('Navigating to Google sign-in …');
  await page.goto(LOGIN_URL);

  if (await page.isVisible('input[type="email"]')) {
    if (GOOGLE_ACCOUNT_USER) {
      await page.fill('input[type="email"]', GOOGLE_ACCOUNT_USER);
      await page.click('button:has-text("Next")');
    } else {
      console.log('Please type your Google email in the browser and click “Next”…');
    }
  }
  await page.waitForSelector('input[type="password"]', { timeout: 0 });

  if (GOOGLE_ACCOUNT_PASSWORD) {
    await page.fill('input[type="password"]', GOOGLE_ACCOUNT_PASSWORD);
    await page.click('button:has-text("Next")');
  } else {
    console.log('Please enter your password (and complete any 2-FA) …');
  }

  console.log('⏳  Waiting until Google Meet UI appears …');
  await page.waitForURL(/https:\/\/meet\.google\.com\/.*/, { timeout: 0 });
  await page.waitForSelector('text=/New meeting|Start an instant meeting|Your meetings/i', {
    timeout: 0,
  });

  const savePath = path.resolve('auth.json');
  await context.storageState({ path: savePath });
  console.log(`Saved logged-in session → ${savePath}`);

  await browser.close();
  console.log('Finished. You can now run the bot containers using this auth.json.');
})().catch((err) => {
  console.error('generate-auth failed:', err);
  process.exit(1);
});
