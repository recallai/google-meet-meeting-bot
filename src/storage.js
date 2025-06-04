"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.saveTranscript = saveTranscript;
exports.saveSummary = saveSummary;
exports.createMeetingJob = createMeetingJob;
exports.updateMeetingStatus = updateMeetingStatus;
exports.getMeetingJob = getMeetingJob;
exports.getTranscript = getTranscript;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function saveTranscript(transcript) {
  console.log(`at start of save transcript`);
  console.dir(transcript);
  const { meetingId, createdAt, segments } = transcript;
  // cannot just upsert segments need to upsert each individual segment.
  await prisma.meetingTranscript.upsert({
    where: { meetingId },
    update: { createdAt },
    create: { meetingId, createdAt },
  });
  console.log(`just upserted`);
  if (segments.length > 0) {
    const parsedSegment = segments.map((seg) => ({
      meetingId,
      start: seg.start,
      end: seg.end,
      text: seg.text,
      speaker: seg.speaker,
    }));
    await prisma.segment.createMany({
      data: parsedSegment,
      skipDuplicates: true,
    });
  }
  console.log(`just created segments`);
}
async function saveSummary(summary) {
  await prisma.meetingSummary.create({
    data: {
      meetingId: summary.meetingId,
      generatedAt: summary.generatedAt,
      summaryText: summary.summaryText,
      model: summary.model,
    },
  });
}
async function createMeetingJob(meetingUrl) {
  return await prisma.meetingJob.create({
    data: { meetingUrl },
  });
}
async function updateMeetingStatus(id, status, meetingId) {
  return await prisma.meetingJob.update({
    where: { id },
    data: {
      status,
      meetingId,
    },
  });
}
async function getMeetingJob(id) {
  return await prisma.meetingJob.findUnique({
    where: { id },
  });
}
async function getTranscript(meetingId) {
  console.log(`meeting id is ${meetingId}`);
  const transcript = await prisma.meetingTranscript.findUniqueOrThrow({
    where: { meetingId },
    include: {
      segments: true,
    },
  });
  console.dir(transcript);
  return {
    meetingId: transcript.meetingId,
    createdAt: transcript.createdAt,
    segments: transcript.segments,
  };
}
