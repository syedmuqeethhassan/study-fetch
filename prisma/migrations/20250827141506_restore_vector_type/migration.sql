/*
  Warnings:

  - You are about to alter the column `embedding` on the `Chunk` table. The data in that column could be lost. The data in that column will be cast from `Text` to `Unsupported("vector(768)")`.

*/
-- Enable vector extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS vector;

-- AlterTable with explicit casting
ALTER TABLE "public"."Chunk" ALTER COLUMN "embedding" SET DATA TYPE vector(768) USING 
  CASE 
    WHEN "embedding" IS NULL THEN NULL
    WHEN "embedding" = '' THEN NULL
    ELSE "embedding"::vector(768)
  END;

-- Recreate the index for vector similarity search
CREATE INDEX IF NOT EXISTS "Chunk_embedding_idx" ON "Chunk" USING ivfflat (embedding vector_cosine_ops);
