-- CreateTable
CREATE TABLE "summary" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL,
    "model" TEXT NOT NULL,

    CONSTRAINT "summary_pkey" PRIMARY KEY ("id")
);
