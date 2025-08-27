import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { readAuthFromRequest } from '@/lib/auth';

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

    // With single-endpoint design, always serve via /api/upload
    const url = `/api/upload`;
    return NextResponse.json({ id: saved.id, filename: saved.filename, url });
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