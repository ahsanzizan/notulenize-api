/*
  Warnings:

  - You are about to drop the `Meeting` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Transcript` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `TranscriptChunk` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `UploadSession` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `User` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "public"."UploadStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'FAILED');

-- DropForeignKey
ALTER TABLE "public"."Meeting" DROP CONSTRAINT "Meeting_userId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Transcript" DROP CONSTRAINT "Transcript_meetingId_fkey";

-- DropForeignKey
ALTER TABLE "public"."TranscriptChunk" DROP CONSTRAINT "TranscriptChunk_transcriptId_fkey";

-- DropForeignKey
ALTER TABLE "public"."UploadSession" DROP CONSTRAINT "UploadSession_userId_fkey";

-- DropForeignKey
ALTER TABLE "public"."summaries" DROP CONSTRAINT "summaries_meetingId_fkey";

-- DropForeignKey
ALTER TABLE "public"."summaries" DROP CONSTRAINT "summaries_transcriptId_fkey";

-- DropTable
DROP TABLE "public"."Meeting";

-- DropTable
DROP TABLE "public"."Transcript";

-- DropTable
DROP TABLE "public"."TranscriptChunk";

-- DropTable
DROP TABLE "public"."UploadSession";

-- DropTable
DROP TABLE "public"."User";

-- DropEnum
DROP TYPE "public"."UploadSessionStatus";

-- CreateTable
CREATE TABLE "public"."users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."meetings" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "audioFileUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "meetings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."transcripts" (
    "id" TEXT NOT NULL,
    "fullText" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "meetingId" TEXT NOT NULL,

    CONSTRAINT "transcripts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."transcript_chunks" (
    "id" TEXT NOT NULL,
    "chunkIndex" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "transcriptId" TEXT NOT NULL,

    CONSTRAINT "transcript_chunks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."upload_sessions" (
    "id" TEXT NOT NULL,
    "status" "public"."UploadStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "filename" TEXT,
    "fileType" TEXT,
    "totalParts" INTEGER,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "upload_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "public"."users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "transcripts_meetingId_key" ON "public"."transcripts"("meetingId");

-- CreateIndex
CREATE UNIQUE INDEX "transcript_chunks_transcriptId_chunkIndex_key" ON "public"."transcript_chunks"("transcriptId", "chunkIndex");

-- AddForeignKey
ALTER TABLE "public"."meetings" ADD CONSTRAINT "meetings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."transcripts" ADD CONSTRAINT "transcripts_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "public"."meetings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."transcript_chunks" ADD CONSTRAINT "transcript_chunks_transcriptId_fkey" FOREIGN KEY ("transcriptId") REFERENCES "public"."transcripts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."upload_sessions" ADD CONSTRAINT "upload_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."summaries" ADD CONSTRAINT "summaries_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "public"."meetings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."summaries" ADD CONSTRAINT "summaries_transcriptId_fkey" FOREIGN KEY ("transcriptId") REFERENCES "public"."transcripts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
