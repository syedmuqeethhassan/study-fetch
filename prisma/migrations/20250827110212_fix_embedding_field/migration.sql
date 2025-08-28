/*
  Warnings:

  - You are about to alter the column `embedding` on the `Chunk` table. The data in that column could be lost. The data in that column will be cast from `Unsupported("vector")` to `Text`.

*/
-- AlterTable
ALTER TABLE "public"."Chunk" ALTER COLUMN "embedding" SET DATA TYPE TEXT;
