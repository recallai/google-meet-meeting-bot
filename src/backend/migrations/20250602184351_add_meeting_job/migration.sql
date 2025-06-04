/*
  Warnings:

  - A unique constraint covering the columns `[meetingId,start]` on the table `Segment` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "MeetingTranscript" ADD CONSTRAINT "MeetingTranscript_pkey" PRIMARY KEY ("id");

-- CreateTable
CREATE TABLE "MeetingJob" (
    "id" TEXT NOT NULL,
    "meetingUrl" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "meetingId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MeetingJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Segment_meetingId_start_key" ON "Segment"("meetingId", "start");
