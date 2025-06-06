// src/backend/botLauncher.ts
import Docker from "dockerode";

// init Docker client
const docker = new Docker();

// launch Docker container to run mtg bot
export async function launchBotContainer(meetingUrl: string, jobId: string) {
  // assign container a unique name using timestamp
  const containerName = `meetingbot-${Date.now()}`;

  const env = [
    `MEETING_URL=${meetingUrl}`,
    `JOB_ID=${jobId}`,
    `GOOGLE_ACCOUNT_USER=${process.env.GOOGLE_ACCOUNT_USER ?? ""}`,
    `GOOGLE_ACCOUNT_PASSWORD=${process.env.GOOGLE_ACCOUNT_PASSWORD ?? ""}`,
    `DATABASE_URL=${process.env.DATABASE_URL}`,
    `OPENAI_API_KEY=${process.env.OPENAI_API_KEY ?? ""}`,
  ];

  // create Docker container with bot image to run, env vars, run cmd
  const container = await docker.createContainer({
    Image: "meetingbot-bot",
    Env: env,
    Cmd: ["node", "dist/bot/index.js"],
    HostConfig: {
      // comment out autoremove for debugging, otherwise cleans after exit
      AutoRemove: true,
      // specifies Docker network to connect to
      NetworkMode: "meetingbot-net",
    },
  });

  await container.start();
  // attach to container logs and stream to curr process output
  const stream = await container.logs({
    follow: true,
    stdout: true,
    stderr: true,
  });
  stream.on("data", (chunk) => process.stdout.write(chunk));

  console.log(`Started bot container: ${containerName}`);
  return containerName;
}
