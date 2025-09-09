/*
  Warnings:

  - The `status` column on the `UploadSession` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "public"."UploadSessionStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'FAILED');

-- AlterTable
ALTER TABLE "public"."UploadSession" DROP COLUMN "status",
ADD COLUMN     "status" "public"."UploadSessionStatus" NOT NULL DEFAULT 'IN_PROGRESS';
