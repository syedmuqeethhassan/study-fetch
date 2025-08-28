import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { readAuthFromRequest } from '@/lib/auth';
import { chunkTextByPages } from '@/lib/chunking';
import pdfParse from 'pdf-parse';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { randomUUID } from 'crypto';

/**
 * Extracts text from PDF buffer and returns text content organized by pages
 */
async function extractTextFromPDF(pdfBuffer: Buffer): Promise<string[]> {
  try {
    const data = await pdfParse(pdfBuffer);
    return data.text.split('\n\n').filter(page => page.trim().length > 0);
  } catch (error) {
    console.error('Error parsing PDF:', error);
    throw new Error('Failed to extract text from PDF');
  }
}

/**
 * Generates embeddings for text using Gemini
 */
async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
    const model = genAI.getGenerativeModel({ model: 'text-embedding-004' });

    const result = await model.embedContent(text);
    return result.embedding.values;
  } catch (error) {
    console.error('Error generating embedding:', error);
    throw new Error('Failed to generate embedding');
  }
}

/**
 * Generates embeddings for multiple chunks sequentially
 */
async function generateEmbeddings(chunks: string[]): Promise<number[][]> {
  try {
    const embeddings: number[][] = [];

    for (const chunk of chunks) {
      const embedding = await generateEmbedding(chunk);
      embeddings.push(embedding);
    }

    return embeddings;
  } catch (error) {
    console.error('Error generating embeddings:', error);
    throw new Error('Failed to generate embeddings');
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await readAuthFromRequest(request);
    if (!auth?.uid || !auth?.sid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Ensure session exists and is not expired
    const session = await prisma.session.findUnique({ where: { id: auth.sid } });
    if (!session || session.userId !== auth.uid || session.expires < new Date()) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Check if file is a PDF
    if (file.type !== 'application/pdf') {
      return NextResponse.json(
        { error: 'Only PDF files are allowed' },
        { status: 400 }
      );
    }

    // Convert File to Buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Store in Neon via Prisma
    const saved = await prisma.pdf.create({
      data: {
        userId: auth.uid,
        filename: file.name,
        mimeType: file.type,
        sizeBytes: buffer.byteLength,
        data: buffer,
      },
      select: { id: true, filename: true },
    });

    // Return PDF URL immediately for instant display
    const url = `/api/upload`;
    const response = NextResponse.json({
      id: saved.id,
      filename: saved.filename,
      url
    });

    // Process PDF chunking and vectorization in background (non-blocking)
    // This runs after the response is sent to the client
    setImmediate(async () => {
      try {
        console.log(`🚀 Starting background processing for PDF ${saved.id}`);
        const textByPage = await extractTextFromPDF(buffer);
        if (textByPage.length > 0) {
          const chunks = chunkTextByPages(textByPage, {
            chunkSize: 1000,
            overlap: 200
          });

          if (chunks.length > 0) {
            console.log(`Starting to process ${chunks.length} chunks for PDF ${saved.id}`);

            // Generate embeddings for all chunks using Gemini
            const chunkTexts = chunks.map(chunk => chunk.content);
            console.log(`Generating embeddings for ${chunkTexts.length} text chunks...`);

            const embeddings = await generateEmbeddings(chunkTexts);
            console.log(`Generated ${embeddings.length} embeddings`);

            // Check if embeddings are valid
            if (!embeddings || embeddings.length === 0) {
              console.error('No embeddings generated!');
              throw new Error('Failed to generate embeddings');
            }

            // Log first embedding to verify it's working
            console.log('First embedding sample:', embeddings[0]?.slice(0, 5), '...');

            // Use raw SQL to insert chunks with vector embeddings
            console.log('💾 Inserting chunks with vector embeddings using raw SQL...');

            const values = chunks.map((chunk, index) => {
              const chunkId = randomUUID();
              const escapedContent = chunk.content.replace(/'/g, "''");
              const vectorString = `[${embeddings[index].join(',')}]`; // Format as PostgreSQL vector

              return `('${chunkId}', '${escapedContent}', '${vectorString}', '${saved.id}', ${chunk.pageNumber}, NOW())`;
            }).join(', ');

            const query = `
              INSERT INTO "Chunk" (id, content, embedding, "pdfId", "pageNumber", "createdAt")
              VALUES ${values}
            `;

            console.log('SQL Query preview (first 100 chars):', query.substring(0, 100) + '...');

            await prisma.$executeRawUnsafe(query);

            console.log(`✅ Successfully created ${chunks.length} vectorized chunks for PDF ${saved.id}`);
            console.log('🎯 Embeddings stored as native PostgreSQL vectors!');
          }
        }
      } catch (chunkingError) {
        console.error('Background chunking/vectorization failed for PDF:', saved.id, chunkingError);
        // Background processing failure doesn't affect the user experience
      }
    });

    return response;
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Failed to upload file' },
      { status: 500 }
    );
  }
} 

export async function GET(request: NextRequest) {
  try {
    const auth = await readAuthFromRequest(request);
    if (!auth?.uid) {
      return new NextResponse('Unauthorized', { status: 401 });
    }



    // Regular PDF serving
    const pdf = await prisma.pdf.findFirst({
      where: { userId: auth.uid },
      orderBy: { createdAt: 'desc' },
    });

    if (!pdf) {
      return new NextResponse('Not found', { status: 404 });
    }

    const nodeBuffer = pdf.data as unknown as Buffer;
    const uint8 = new Uint8Array(nodeBuffer);
    const blob = new Blob([uint8], { type: pdf.mimeType });
    return new NextResponse(blob, {
      status: 200,
      headers: {
        'Content-Type': pdf.mimeType,
        'Content-Disposition': `inline; filename="${encodeURIComponent(pdf.filename)}"`,
        'Content-Length': String(pdf.sizeBytes),
        'Cache-Control': 'private, max-age=0, must-revalidate',
      },
    });
  } catch (error) {
    console.error('Get latest PDF error:', error);
    return new NextResponse('Internal server error', { status: 500 });
  }
}