/*
  Warnings:

  - You are about to drop the column `text` on the `MeetingSummary` table. All the data in the column will be lost.
  - Added the required column `summaryText` to the `MeetingSummary` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "MeetingSummary" DROP COLUMN "text",
ADD COLUMN     "summaryText" TEXT NOT NULL;
