-- Enable vector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- CreateTable
CREATE TABLE "Chunk" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "embedding" vector(1536),
    "pdfId" TEXT NOT NULL,
    "pageNumber" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Chunk_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Chunk_pdfId_idx" ON "Chunk"("pdfId");

-- CreateIndex for vector similarity search
CREATE INDEX "Chunk_embedding_idx" ON "Chunk" USING ivfflat (embedding vector_cosine_ops);

-- AddForeignKey
ALTER TABLE "Chunk" ADD CONSTRAINT "Chunk_pdfId_fkey" FOREIGN KEY ("pdfId") REFERENCES "Pdf"("id") ON DELETE CASCADE ON UPDATE CASCADE;