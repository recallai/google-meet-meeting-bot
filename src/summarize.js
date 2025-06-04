"use strict";
var __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod };
  };
Object.defineProperty(exports, "__esModule", { value: true });
exports.summarizeTranscript = summarizeTranscript;
const openai_1 = __importDefault(require("openai"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const client = new openai_1.default({
  apiKey: process.env.OPEN_API_KEY,
});
async function summarizeTranscript(transcript) {
  const combinedSegments = transcript.segments
    .map((segment) => segment.text)
    .join(" ");
  const meetingId = transcript.meetingId;
  try {
    console.log(`about to call openai api with ${combinedSegments}`);
    const resp = await client.responses.create({
      model: "gpt-4.1",
      instructions: `You are the most helpful assistant to ever summarize transcripts/meetings with clarity and brevity.`,
      input: `Here is the transcript of a meeting:\n\n${combinedSegments}\n\nPlease provide your best summary`,
    });
    console.log(`generated text is: ${resp.output_text}`);
    return {
      meetingId,
      generatedAt: new Date(),
      summaryText: resp.output_text,
      model: "gpt-4.1",
    };
  } catch (err) {
    console.error(`Failed to summarize transcript ${err}`);
    throw new Error(`OpenAI Error`);
  }
}
