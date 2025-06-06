import { BrowserContext, chromium } from "playwright";
import { saveTranscriptBatch } from "../storage";
import { v4 as uuidv4 } from "uuid";
import { Page } from "playwright";
import { Segment } from "src/models";

// bot will leave the meeting immediately if it hears any of the following phrases
const EXIT_PHRASES = [
  "notetaker, please leave",
  "note taker, please leave",
  "no taker please leave",
  "notetaker please leave",
].map((p) => p.toLowerCase());

// flush interval to save captions
const FLUSH_EVERY_MS = 1_000;

// selector used to detect the meeting has ended
const LEAVE_BANNER_SEL =
  'body > div[role="heading"]:has-text("You left the meeting"),' +
  'body > div[role="heading"]:has-text("You’ve left the call")';

// launches broswer, joins Google Meet, records captions
export async function runBot(url: string): Promise<string> {
  const meetingId = uuidv4();
  const createdAt = new Date();

  // ensures meeting always exists
  await saveTranscriptBatch(meetingId, createdAt, [], true);

  const browser = await chromium.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--use-fake-ui-for-media-stream",
      "--use-fake-device-for-media-stream",
    ],
  });

  const context: BrowserContext = await browser.newContext({
    storageState: "auth.json",
  });
  const page = await context.newPage();

  // for debugging so that you see all console lines in terminal
  page.on("console", (msg) => console.log(`[page:${msg.type()}]`, msg.text()));

  try {
    await context.tracing.start({ screenshots: true, snapshots: true });

    await page.goto(url, { waitUntil: "domcontentloaded" });

    // mute mic, turn off camera, clear popup
    await clickIfVisible(page, 'button[aria-label*="Turn off microphone"]');
    await clickIfVisible(page, 'button[aria-label*="Turn off camera"]');
    await clickIfVisible(page, 'button:has-text("Got it")');

    console.log("Current URL:", page.url());
    console.log(
      "Visible buttons on screen:",
      await page.locator("button").allTextContents(),
    );

    // join/ask to join, handle 2-step join preview, close modals, wait until in meeting
    await clickJoin(page);
    await collapsePreviewIfNeeded(page);
    await dismissOverlays(page);
    await waitUntilJoined(page);
    console.log("joined meeting");

    // turn captions on
    await ensureCaptionsOn(page);
    console.log("captions visible");

    // scrape captions
    const mid = await scrapeCaptions(page, meetingId, createdAt);
    console.log("done scraping. Returning meetingId.");

    await context.tracing.stop({ path: "run.zip" });
    return mid;
  } catch (err) {
    throw new Error(`Run Bot error: ${err}`);
  }
}

async function scrapeCaptions(
  page: Page,
  meetingId: string,
  createdAt: Date,
): Promise<string> {
  // index = caption timing, flushedCount = how many segments have been saved
  // exitRequested = exit condition, segments = finalized segments, activeSegments = ongoing segment for speaker
  let index = 0;
  let flushedCount = 0;
  let exitRequested = false;
  const segments: Segment[] = [];
  const activeSegments = new Map<string, Segment>();

  // filter system msgs
  const isNotRealCaption = (text: string) =>
    /you left the meeting|return to home screen|leave call|feedback|audio and video|learn more/.test(
      text.toLowerCase(),
    );

  // browser-side func to receive captions from injected observer
  await page.exposeFunction(
    "onCaption",
    async (speaker: string, text: string) => {
      const caption = text.trim();
      if (!caption) return;

      const normalized = caption.toLowerCase();
      const isExit = EXIT_PHRASES.some((p) => normalized.includes(p));
      if (isExit) {
        console.log("Exit phrase heard — hanging up");
        exitRequested = true;
      }

      const existing = activeSegments.get(speaker);

      if (!existing) {
        // first segment for speaker
        const seg = {
          speaker,
          text: caption,
          start: index,
          end: index + 1,
          meetingId,
        };
        activeSegments.set(speaker, seg);
      } else {
        // update existing segment if caption is growing
        if (
          caption.startsWith(existing.text) ||
          caption.length > existing.text.length + 5
        ) {
          existing.text = caption;
          existing.end = index + 1;
        }
      }

      index++;
      // if exit = triggered, flush curr captions
      if (isExit) {
        const finalSegments = Array.from(activeSegments.values());
        await saveTranscriptBatch(meetingId, createdAt, finalSegments, true);
      }
    },
  );

  // wait for captions to be initialized
  await page.waitForSelector("[aria-live]");

  await page.waitForFunction(() => {
    const live = Array.from(
      document.querySelectorAll<HTMLElement>("[aria-live]"),
    );
    return live.some((el) => el.textContent?.trim().length);
  });

  // inject observer into page to listen to DOM changes & send caption updates
  await page.evaluate(() => {
    const badgeSel = ".NWpY1d, .xoMHSc";
    let lastSpeaker = "Unknown Speaker";

    // extract speaker
    const getSpeaker = (node: HTMLElement): string => {
      const badge = node.querySelector<HTMLElement>(badgeSel);
      const speaker = badge?.textContent?.trim();
      return speaker || lastSpeaker;
    };

    // extract caption
    const getText = (node: HTMLElement): string => {
      const clone = node.cloneNode(true) as HTMLElement;
      clone
        .querySelectorAll<HTMLElement>(badgeSel)
        .forEach((el) => el.remove());
      return clone.textContent?.trim() ?? "";
    };

    // send caption to exposed onCaption()
    const send = (node: HTMLElement): void => {
      const txt = getText(node);
      const spk = getSpeaker(node);
      if (txt && txt.toLowerCase() !== spk.toLowerCase()) {
        // @ts-expect-error
        window.onCaption?.(spk, txt);
        lastSpeaker = spk;
      }
    };

    // watch DOm for caption updates and run send()
    new MutationObserver((mutations) => {
      for (const m of mutations) {
        // new caption elements
        Array.from(m.addedNodes).forEach((n) => {
          if (n instanceof HTMLElement) send(n);
        });
        // live text edits inside an existing element
        if (
          m.type === "characterData" &&
          m.target?.parentElement instanceof HTMLElement
        ) {
          send(m.target.parentElement);
        }
      }
    }).observe(document.body, {
      childList: true,
      characterData: true,
      subtree: true,
    });
  });

  // flush segments to backend
  const flushTimer = setInterval(async () => {
    const segmentsToFlush = Array.from(activeSegments.values());
    if (segmentsToFlush.length) {
      await saveTranscriptBatch(meetingId, createdAt, segmentsToFlush);
    }
  }, FLUSH_EVERY_MS);

  // leave call and final flush
  const leaveCall = async () => {
    const hangUpSel =
      'button[aria-label*="Leave call"], button[aria-label*="Leave meeting"]';
    if (await page.$(hangUpSel)) {
      await clickIfVisible(page, hangUpSel);
    } else {
      await page.keyboard.press("Ctrl+Alt+Q");
    }
    await page
      .waitForSelector(LEAVE_BANNER_SEL, { timeout: 10_000 })
      .catch(() => undefined);
    await saveTranscriptBatch(
      meetingId,
      createdAt,
      segments.slice(flushedCount),
    )
      .then(() => {
        flushedCount = segments.length;
      })
      .catch((err) => console.error("[FLUSH-after-leave] failed", err));
  };

  // exit conditions (exit phrase, leave banner, hard timeout)
  await Promise.race([
    (async () => {
      while (!exitRequested) await new Promise((r) => setTimeout(r, 500));
      await leaveCall();
    })(),
    page.waitForSelector(LEAVE_BANNER_SEL, { timeout: 0 }),
    new Promise((_, rej) =>
      setTimeout(
        () => rej(new Error("Hard timeout (100 min) exceeded")),
        100 * 60 * 1000,
      ),
    ),
  ]);

  // final flush and cleanup
  clearInterval(flushTimer);
  const finalSegments = Array.from(activeSegments.values()).filter(
    (seg) => !isNotRealCaption(seg.text) || seg.end < index - 2,
  );

  await saveTranscriptBatch(meetingId, createdAt, finalSegments, true);

  // done, notify backend to trigger summarizer
  try {
    const jobId = process.env.JOB_ID;
    if (!jobId)
      console.warn("Missing JOB_ID env var – summary worker won’t start");
    else {
      const res = await fetch("http://backend:3001/bot-done", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId, meetingId }),
      });
      console.log(`[bot-done] ${res.status}`);
    }
  } catch (err) {
    console.error("[bot-done] POST failed:", err);
  }
  console.log(`Meeting ${meetingId}: ${segments.length} segments captured`);
  return meetingId;
}

// click visible element by selector, true if successful
async function clickIfVisible(page: Page, selector: string, timeout = 5000) {
  try {
    const elem = page.locator(selector);
    await elem.waitFor({ state: "visible", timeout });
    await elem.click();
    return true;
  } catch {
    return false;
  }
}

// join mtg by clicking "Join" button/fallbacks
async function clickJoin(page: Page): Promise<void> {
  const allButtons = await page.locator("button").allTextContents();
  console.log("Visible buttons on screen:", allButtons);

  const continueBtn = page.locator(
    'button:has-text("Continue without microphone and camera")',
  );
  try {
    await continueBtn.waitFor({ state: "visible", timeout: 3000 });
    await continueBtn.click();
    console.log('Clicked: "Continue without microphone and camera"');
    await page.waitForTimeout(1000);
  } catch {
    console.log('ℹ "Continue without microphone and camera" not shown');
  }

  // try related possibilites for joining
  const possibleTexts = [
    "Join now",
    "Ask to join",
    "Join meeting",
    "Join call",
    "Join",
    "Done",
    "Continue",
    "Continue to join",
    "Start meeting",
  ];

  for (const text of possibleTexts) {
    const btn = page.locator(`button:has-text("${text}")`).first();
    try {
      await btn.waitFor({ state: "visible", timeout: 3000 });
      await btn.click();
      console.log(`Clicked join button: "${text}"`);
      return;
    } catch (err) {
      console.log(
        `Skipped "${text}" – ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  // fallback to any button with "join" in it
  const fallbackButtons = page.locator("button");
  const count = await fallbackButtons.count();
  for (let i = 0; i < count; i++) {
    const btn = fallbackButtons.nth(i);
    const label = (await btn.textContent())?.trim();
    if (label && /join/i.test(label)) {
      try {
        await btn.click();
        console.log(`Fallback: clicked button with text "${label}"`);
        return;
      } catch {}
    }
  }
  // last effort = press Enter
  console.warn("No join button found — pressing Enter as fallback");
  await page.keyboard.press("Enter");
}

// waits until bot is in the call/added to the call
async function waitUntilJoined(page: Page, timeoutMs = 60_000) {
  const inCall = await Promise.race([
    page.waitForSelector('button[aria-label*="Leave call"]', {
      timeout: timeoutMs,
    }),
    page.waitForSelector("text=You've been admitted", { timeout: timeoutMs }),
    page.waitForSelector("text=You’re the only one here", {
      timeout: timeoutMs,
    }),
  ]).catch(() => false);

  if (!inCall) throw new Error("Not admitted within time limit");
}

// sometimes there is a preview, handle preview here
async function collapsePreviewIfNeeded(page: Page) {
  const previewJoin = page.getByRole("button", { name: /join now/i }).nth(1);
  if (await previewJoin.isVisible({ timeout: 3000 })) {
    await previewJoin.click();
    console.log("clicked 2‑step Join");
  }
}

// dismiss modals like "Continue" using click/escape
async function dismissOverlays(page: Page) {
  const selectors = [
    'button:has-text("Got it")',
    'button:has-text("Dismiss")',
    'button:has-text("Continue")',
  ];
  for (const sel of selectors) {
    await clickIfVisible(page, sel, 1_000);
  }

  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  await page.keyboard.press("Escape");
}

// returns true if captions region is present and visible
async function captionsRegionVisible(page: Page, t = 4000): Promise<boolean> {
  const region = page.locator('[role="region"][aria-label*="Captions"]');
  try {
    await region.waitFor({ timeout: t });

    if (await region.isVisible().catch(() => false)) return true;

    console.warn("Captions region found but not visibly rendered yet");
    return true;
  } catch {
    return false;
  }
}

// make sure captions are enabled
async function ensureCaptionsOn(page: Page, timeoutMs = 60_000) {
  console.log(" Waiting for UI to stabilize after join...");
  await page.waitForTimeout(5000);

  // close overlays if blocking interaction
  const overlay = page.locator('div[data-disable-esc-to-close="true"]');
  for (let i = 0; i < 8; i++) {
    if (!(await overlay.isVisible().catch(() => false))) break;
    await page.keyboard.press("Escape");
    await page.waitForTimeout(200);
  }

  // keyboard shortcut with limited attempts
  for (let i = 0; i < 10; i++) {
    console.log(`Attempt ${i + 1}: Pressing Shift+C`);
    await page.keyboard.down("Shift");
    await page.keyboard.press("c");
    await page.keyboard.up("Shift");

    if (await captionsRegionVisible(page, 800)) {
      console.log("Captions enabled via Shift+C");
      return;
    }

    // are captions already on
    const ccOffBtn = page.locator('button[aria-label*="Turn off captions"]');
    if (await ccOffBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      console.log("Captions are already ON (confirmed by CC button state)");
      return;
    }

    await page.waitForTimeout(600);
  }

  // fallback, click "Turn on captions" button
  console.log(' Falling back to clicking "Turn on captions" button...');
  await page.mouse.move(500, 700);
  await page.waitForTimeout(300);

  const ccButton = page.locator('button[aria-label*="Turn on captions"]');
  try {
    await ccButton.waitFor({ state: "visible", timeout: 4000 });
    await ccButton.click();
    if (await captionsRegionVisible(page, 5000)) {
      console.log("captions enabled via CC button fallback");
      return;
    }
  } catch {
    console.warn("CC button fallback failed");
  }

  // debug info if captions aren't on
  const visibleRegions = await page
    .locator('[role="region"]')
    .allTextContents();
  console.log("visible regions:", visibleRegions);

  const regions = await page.locator('[role="region"]').elementHandles();
  for (const r of regions) {
    const label = await r.getAttribute("aria-label");
    console.log("Region aria-label:", label);
  }

  // screenshot for debug
  const timestamp = Date.now();
  const path = `/tmp/captions-failure-${timestamp}.png`;
  await page.screenshot({ path });
  console.error(`captions could not be enabled – see ${path}`);
  throw new Error("could not enable captions using Shift+C or button");
}
