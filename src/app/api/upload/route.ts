import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { readAuthFromRequest } from '@/lib/auth';
import { chunkTextByPages } from '@/lib/chunking';
import pdfParse from 'pdf-parse';
// import { GoogleGenerativeAI } from '@google/generative-ai'; // Disabled: Vector embeddings
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

// /**
//  * Generates embeddings for text using Gemini - DISABLED
//  */
// async function generateEmbedding(text: string): Promise<number[]> {
//   try {
//     // Debug: Check if API key is available
//     const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
//     console.log('API Key status:', apiKey ? 'Present' : 'Missing');
//     
//     if (!apiKey) {
//       throw new Error('GOOGLE_GENERATIVE_AI_API_KEY environment variable is not set');
//     }
//     
//     console.log('API Key length:', apiKey.length);
//     console.log('API Key first 10 chars:', apiKey.substring(0, 10) + '...');
//     
//     const genAI = new GoogleGenerativeAI(apiKey);
//     const model = genAI.getGenerativeModel({ model: 'text-embedding-004' });

//     const result = await model.embedContent(text);
//     return result.embedding.values;
//   } catch (error) {
//     console.error('Error generating embedding:', error);
//     if (error instanceof Error) {
//       console.error('Error message:', error.message);
//       console.error('Error stack:', error.stack);
//     }
//     throw new Error(`Failed to generate embedding: ${error instanceof Error ? error.message : 'Unknown error'}`);
//   }
// }

// /**
//  * Generates embeddings for multiple chunks sequentially - DISABLED
//  */
// async function generateEmbeddings(chunks: string[]): Promise<number[][]> {
//   try {
//     const embeddings: number[][] = [];

//     for (const chunk of chunks) {
//       const embedding = await generateEmbedding(chunk);
//       embeddings.push(embedding);
//     }

//     return embeddings;
//   } catch (error) {
//     console.error('Error generating embeddings:', error);
//     throw new Error('Failed to generate embeddings');
//   }
// }

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

    // Delete existing chat messages for this user (since we're uploading a new PDF)
    await prisma.message.deleteMany({
      where: { userId: auth.uid }
    });

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

    // Process PDF chunking in background (non-blocking) - vectorization disabled
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

            // Store chunks without embeddings (embeddings disabled)
            console.log(`💾 Inserting ${chunks.length} chunks without embeddings...`);

            // Use Prisma to insert chunks without embeddings
            const chunkData = chunks.map(chunk => ({
              id: randomUUID(),
              content: chunk.content,
              pdfId: saved.id,
              pageNumber: chunk.pageNumber,
              // embedding field omitted - will be null
            }));

            await prisma.chunk.createMany({
              data: chunkData,
            });

            console.log(`✅ Successfully created ${chunks.length} chunks for PDF ${saved.id}`);
          }
        }
      } catch (chunkingError) {
        console.error('Background chunking failed for PDF:', saved.id, chunkingError);
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