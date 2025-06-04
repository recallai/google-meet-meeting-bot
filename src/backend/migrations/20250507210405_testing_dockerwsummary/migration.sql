/*
  Warnings:

  - You are about to drop the `summary` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE "summary";

-- CreateTable
CREATE TABLE "Summary" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL,
    "model" TEXT NOT NULL,

    CONSTRAINT "Summary_pkey" PRIMARY KEY ("id")
);
