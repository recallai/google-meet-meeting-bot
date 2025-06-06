# Google Meet Meeting Bot

This is a PoC that joins a Google Meet, scrapes live captions, sends captions to OpenAI for summarization, and stores the transcript and summary in PostgreSQL. I've added a small frontend to allow users to submit meeting links.

If you're interested in the process, reasoning, demos, and more, [check out the blog](https://www.recall.ai/blog/how-we-built-an-in-house-google-meet-bot).

## Tech Stack
- Node.js / TypeScript
- Playwright (headless browser bot)
- OpenAI API
- PostgreSQL
- Docker + Docker Compose
- Prisma ORM
- Express (API) + simple HTML (frontend)

## Steps

- Join Meet using Playwright
- Scrape captions from the DOM
- Flush transcript to PostgreSQL
- Call OpenAI for summary generation
- Store summary in PostgreSQL
- Create web UI so that meeting links can be submitted

## How to run the project

1. Install prereqs
    - [Docker](https://docs.docker.com/get-started/get-docker/)
    - Node.js
        - Open terminal and run `sudo apt install nodejs` then run `node -v` to confirm installation
    - Install a package manager
        - eg for npm on Linux: run `sudo apt install npm` then `npm -v` to confirm installation
    - [Git](https://git-scm.com)
    - A [Google account](https://accounts.google.com) to join meetings
    - An [OpenAI API key](https://platform.openai.com/account/api-keys)

2. Clone the Repository

```bash
git clone https://github.com/recallai/google-meet-meeting-bot.git
cd google-meet-meeting-bot
```

3. Copy the .env.sample file and rename to .env in root replacing the placeholder values for your own values:
    ```
    DATABASE_URL=postgresql://meetingbot:yourpassword@postgres:5432/meetingbotpoc
    OPENAI_API_KEY=your-openai-api-key
    GOOGLE_ACCOUNT_USER=your-google-email
    GOOGLE_ACCOUNT_PASSWORD=your-google-password
    ```

4. You must run Playwright **MANUALLY** once to log in generate the `auth.json` file (instructions for this are at the bottom if you need them)

> Do NOT commit your `auth.json` or `.env` file to Git. I've already added both to `.gitignore`

5. Run Database Migrations

Prisma's migration files are already included in the repo. To apply them:

```
cd src/backend
npx prisma migrate deploy
```
This will apply the schema to your local PostgreSQL instance (spun up by Docker).

> Note: If you're modifying the schema yourself, use `npx prisma migrate dev` instead to generate new migrations.

6. Run your code: 
```
docker-compose up --build
```

7. Start a Google Meet
- Start a meeting with your primary Google account (not the bot account you created)
- copy the url before the '?' (put in a note or somewhere you can return to)
- Go to the "Host Controls" in the bottom right-hand corner
- Select "Open" in "Meeting Access"

8. Navigate to your basic frontend
- Open a new tab
- Paste the following url: 
http://localhost:5173
- Copy the meeting url you stored in the previous step
- Paste it into your bar and hit submit

9. Conduct your meeting
- Make sure you are unmuted in the Google Meet tab you have open 
- Have a conversation and when you want your bot to leave, either end the meeting or say "Notetaker, please leave" 
- The bot will send the transcript to OpenAI if you've provided a valid API key and your summary will be stored. 


10. Checking your data
- To see your meeting summary after the call:
```sql
SELECT "meetingId",
       "generatedAt",
       "model",
       "summaryText"
FROM   "MeetingSummary"
ORDER  BY "generatedAt" DESC
LIMIT  1;
```
- To see your transcript: 
```sql
SELECT t."meetingId",
       t."createdAt",
       json_agg(
         json_build_object(
           'start',   s.start,
           'end',     s."end",
           'speaker', s.speaker,
           'text',    s.text
         )
         ORDER BY s.start
       ) AS segments
FROM   "MeetingTranscript" t
JOIN   "Segment"           s USING ("meetingId")
WHERE  t."meetingId" = (
          SELECT "meetingId"
          FROM   "MeetingTranscript"
          ORDER  BY "createdAt" DESC
          LIMIT  1
      )
GROUP  BY t."meetingId", t."createdAt";
```


Happy meeting!

## Project Structure

```
google-meet-meeting-bot/
├── src/
│   ├── backend/
│   │   ├── migrations/
│   │   ├── server.ts
│   │   ├── package.json
│   │   ├── package-lock.json
│   │   ├── tsconfig.json
│   │   ├── launchBot.ts
│   │   └── schema.prisma
│   ├── bot/
│   │   ├── index.ts
│   │   ├── package.json
│   │   ├── package-lock.json
│   │   └── tsconfig.json
│   └── frontend/
│       ├── index.html   # form
│       ├── main.ts
│       ├── style.css
│       ├── tsconfig.json
│       ├── package.json
│       └── package-lock.json
├── playwright/
│   ├── Dockerfile
│   ├── package.json
│   ├── package-lock.json
│   ├── tsconfig.json
│   ├── runBot.ts
│   ├── storage.ts
│   ├── models.ts
│   └── summarize.ts
├── package.json
├── tsconfig.json
├── .env
├── Dockerfile.be
├── Dockerfile.bot
├── docker-compose.yml
├── auth.json            # created by logging into the site via playwright and then storing credentials
└── README.md
```

### Bonus: Want Something More Scalable?
 If you're set making this production-ready or integrating with other platforms (Zoom, Teams, Meet), check out [Recall.ai](https://www.recall.ai/). We provide a [Desktop Recorder SDK](https://docs.recall.ai/docs/desktop-sdk) and multi-platform meeting bot infrastructure, which can simplify and scale what this PoC demonstrates.

I know I'm biased, but I high recommended looking into the Recall.ai API if you're looking to move beyond prototypes or checking out some of [our customers and case studies](https://recall-ai.webflow.io/customers) if you're wondering how you might leverage conversation data in your product.


### Step-by-Step: Generate `auth.json`
#### Start an interactive Playwright session in a browser:

`npx playwright codegen https://meet.google.com`

#### Sign in to your Google account in the browser window that opens:

Use the same account you'll use for the bot (which is whatever you set in your env file).

Complete 2FA if prompted.

Once you're fully signed in and can see the Google Meet homepage, you're good.

#### Save the session to `auth.json`:

In the Playwright UI (top bar), click the “Record” dropdown, and choose "Save storage state".

Save it as `auth.json` in the root of your project

### Huge Thanks To...
Amanda for giving me the opportunity to work on this project. YK for showing me the ropes. Antonio for the eng side onboarding. Gerry for his invaluable feedback. The entire Recall.ai team for being such a stellar and generous team!

<img src="https://recall.ai/pixel-7f38da2c95a84e169c43e6b1d14c7e29?repo=google-meet-meeting-bot" width="1" height="1" style="display:none;" alt="" />
