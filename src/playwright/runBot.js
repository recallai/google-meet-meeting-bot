"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runBot = runBot;
const playwright_1 = require("playwright");
const storage_1 = require("../storage");
const uuid_1 = require("uuid");
const TIMELIMIT = 3000000;
async function runBot(url) {
  // join the meeting
  // enable captions
  // scrape the captions
  // format the captions
  // save the captions (as transcript)
  // potentially call OpenAI API to summarize (this could also be another button on our page that takes the meeting id or meeting link and summarizes the meeting)
  // store the summary
  const meetingId = (0, uuid_1.v4)();
  const createdAt = new Date();
  const browser = await playwright_1.chromium.launch({
    headless: false,
    args: ["--auto-open-devtools-for-tabs"],
  });
  const context = await browser.newContext();
  const page = await context.newPage();
  await login(page);
  console.log(`back to the main runbot function`);
  try {
    await page.goto(url, { waitUntil: "domcontentloaded" });
    const aVSettings = await page.getByRole("button", {
      name: /continue without microphone and camera/i,
    });
    await aVSettings.click();
    await page.waitForTimeout(6000);
    const join = await page.getByRole("button", {
      name: /join now/i,
    });
    await join.click();
    await page.waitForTimeout(6000);
    const mid = await scrapeCaptions(page, meetingId, createdAt);
    console.log(`done scraping. Returning meetingId.`);
    return mid;
  } catch (err) {
    throw new Error(`Run Bot error: ${err}`);
  }
}
async function scrapeCaptions(page, meetingId, createdAt) {
  let index = 0;
  console.log(`at start of scrapeCaptions`);
  let captionsLastSeenAt = Date.now();
  const segments = [];
  console.log(`setting up observer before captions start`);
  await page.exposeFunction("onCaption", (speaker, text) => {
    console.log(`🗣️ ${speaker}: ${text}`);
    captionsLastSeenAt = Date.now();
    const trimmedCaption = text.trim();
    if (trimmedCaption) {
      segments.push({
        speaker,
        text: trimmedCaption,
        start: index,
        end: index + 1,
      });
      index++;
    }
  });
  await page.evaluate(() => {
    console.log(`caption MutationObserver setup`);
    const captionRegion = document.querySelector(
      '[role="region"][aria-label*="Captions"]',
    );
    if (!captionRegion) {
      console.warn("caption region not found");
      return;
    }
    let lastKnownSpeaker = "Unknown Speaker";
    const seenCaptions = new Set();
    const handleNode = (node) => {
      const speakerElem = node.querySelector(".NWpY1d");
      let speaker = speakerElem?.textContent?.trim() || lastKnownSpeaker;
      if (speaker !== "Unknown Speaker") {
        lastKnownSpeaker = speaker;
      }
      const clone = node.cloneNode(true);
      const speakerLabel = clone.querySelector(".NWpY1d");
      if (speakerLabel) speakerLabel.remove();
      const caption = clone.textContent?.trim() || "";
      if (
        caption &&
        caption.toLowerCase() !== speaker.toLowerCase() &&
        !seenCaptions.has(caption)
      ) {
        seenCaptions.add(caption);
        // @ts-expect-error: onCaption is injected at runtime
        window.onCaption?.(speaker, caption);
      }
    };
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        const nodes = Array.from(mutation.addedNodes);
        if (nodes.length > 0) {
          nodes.forEach((node) => {
            if (node instanceof HTMLElement) {
              handleNode(node);
            }
          });
        } else if (
          mutation.type === "characterData" &&
          mutation.target.parentElement instanceof HTMLElement
        ) {
          handleNode(mutation.target.parentElement);
        }
      }
    });
    observer.observe(captionRegion, {
      childList: true,
      subtree: true,
      characterData: true,
      characterDataOldValue: true,
    });
  });
  await turnCaptionsOn(page);
  await page.waitForSelector('[role="region"][aria-label*="Captions"]', {
    timeout: 10000,
    state: "visible",
  });
  const MAX_IDLE_TIME = 30000;
  const MAX_TOTAL_TIME = 6000000;
  const startTime = Date.now();
  return await new Promise((resolve) => {
    const isWorking = setInterval(async () => {
      const curr = Date.now();
      const idleTime = curr - captionsLastSeenAt;
      const totalTime = curr - startTime;
      if (idleTime > MAX_IDLE_TIME || totalTime > MAX_TOTAL_TIME) {
        clearInterval(isWorking);
        console.log(` idle for ${idleTime} or total ${totalTime}`);
        await (0, storage_1.saveTranscript)({
          meetingId,
          createdAt,
          segments,
        });
        if (segments.length === 0) {
          console.warn(`no captions captured for meeting ${meetingId}`);
        } else {
          console.log(`segments captured ${segments.length} caption segments`);
        }
        const jobId = process.env.JOB_ID;
        await fetch(`http://backend:3000/bot-done`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jobId, meetingId }),
        });
        resolve(meetingId);
      }
    }, 3000);
  });
}
async function turnCaptionsOn(page) {
  const captions = await page.press("body", "Shift+c");
  await page.waitForTimeout(6000);
}
async function login(page) {
  const email = process.env.GOOGLE_ACCOUNT_USER;
  const password = process.env.GOOGLE_ACCOUNT_PASSWORD;
  if (!email || !password) throw new Error("Missing Google login credentials");
  await page.goto("https://accounts.google.com/", { waitUntil: "load" });
  await page.fill('input[type="email"]', email);
  await Promise.all([
    page.click("#identifierNext"),
    page.waitForURL(/accounts\.google\.com\/v3\/signin\/challenge\/pwd/, {
      timeout: 10000,
      waitUntil: "domcontentloaded",
    }),
  ]);
  const passwordInput = page.locator(
    'input[type="password"]:not([aria-hidden="true"])',
  );
  await passwordInput.waitFor({ state: "visible", timeout: 10000 });
  await passwordInput.fill(password);
  await Promise.all([
    page.click("#passwordNext"),
    page.waitForURL(/myaccount\.google\.com/, {
      timeout: 10000,
      waitUntil: "domcontentloaded",
    }),
  ]);
  await page.waitForTimeout(3000);
  console.log(`logged in`);
}
