import { MeetingSummaryInput, MeetingTranscript } from "./models";
import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();
// init OpenAI client with key from .env file
const client = new OpenAI({
  apiKey: process.env.OPEN_API_KEY,
});

// return summary given a transcript
export async function summarizeTranscript(
  transcript: MeetingTranscript,
): Promise<MeetingSummaryInput> {
  // combine all segments to one long string
  const combinedSegments = transcript.segments
    .map((segment) => segment.text)
    .join(" ");
  const meetingId = transcript.meetingId;

  try {
    console.log(`about to call openai api with ${combinedSegments}`);
    const resp = await client.responses.create({
      // use whatever model you want
      model: "gpt-4.1",
      instructions: `You are the most helpful assistant to ever summarize transcripts/meetings with clarity and brevity.`,
      input: `Here is the transcript of a meeting:\n\n${combinedSegments}\n\nPlease provide your best summary`,
    });
    console.log(`generated text is: ${resp.output_text}`);

    // return summary object with metadata
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
