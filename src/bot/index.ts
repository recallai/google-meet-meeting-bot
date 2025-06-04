import { runBot } from "../playwright/runBot";

// immediately runs bot logic (launchBot.ts specifies to run this file)
(async () => {
  const url = process.env.MEETING_URL;
  const jobId = process.env.JOB_ID;

  // exit if no url was given
  if (!url) {
    console.error("Missing MEETING_URL env var");
    process.exit(1);
  }

  try {
    const meetingId = await runBot(url);
    console.log(`Bot finished, meetingId=${meetingId}`);

    // send job completion to backend to summarize and update
    if (jobId) {
      await fetch("http://backend:3000/bot-done", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId, meetingId }),
      });
    }
    // success
    process.exit(0);
  } catch (err) {
    console.error("runBot failed:", err);
    process.exit(1);
  }
})();
