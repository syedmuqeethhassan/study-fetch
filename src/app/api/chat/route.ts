import { google } from '@ai-sdk/google';
import { streamText } from 'ai';
import { NextRequest, NextResponse } from 'next/server';
import { readAuthFromRequest } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    const auth = await readAuthFromRequest(req);
    if (!auth?.uid || !auth?.sid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Ensure session exists and is not expired
    const session = await prisma.session.findUnique({ where: { id: auth.sid } });
    if (!session || session.userId !== auth.uid || session.expires < new Date()) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { messages } = body;

    // Validate messages array
    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: 'Invalid request: messages array is required' },
        { status: 400 }
      );
    }

    if (messages.length === 0) {
      return NextResponse.json(
        { error: 'Invalid request: at least one message is required' },
        { status: 400 }
      );
    }

    // Ensure all messages have the required structure
    const validMessages = messages.map((msg: any) => {
      let content = '';
      
      // Handle different message formats
      if (msg.content) {
        content = msg.content;
      } else if (msg.text) {
        content = msg.text;
      } else if (msg.parts && Array.isArray(msg.parts)) {
        // Handle the new AI SDK format with parts
        content = msg.parts
          .filter((part: any) => part.type === 'text')
          .map((part: any) => part.text)
          .join(' ');
      }
      
      return {
        role: msg.role as 'user' | 'assistant' | 'system' || 'user',
        content: content || 'Empty message',
      };
    }).filter(msg => msg.content.trim() !== '' && msg.content !== 'Empty message');

    // Check if we have valid messages after filtering
    if (validMessages.length === 0) {
      return NextResponse.json(
        { error: 'No valid messages found in request' },
        { status: 400 }
      );
    }

    // Get the latest PDF for this user
    const latestPdf = await prisma.pdf.findFirst({
      where: { userId: auth.uid },
      orderBy: { createdAt: 'desc' },
      include: {
        chunks: {
          orderBy: { createdAt: 'asc' }
        }
      }
    });

    if (!latestPdf) {
      return NextResponse.json({ error: 'No PDF found. Please upload a PDF first.' }, { status: 400 });
    }

    // Check if this is the first message for this PDF
    const existingMessageCount = await prisma.message.count({
      where: { userId: auth.uid, pdfId: latestPdf.id }
    });

    const isFirstMessage = existingMessageCount === 0;
    console.log(`Chat optimization: isFirstMessage=${isFirstMessage}, existingMessages=${existingMessageCount}`);

    // Get the user's question from the last message
    const lastMessage = validMessages[validMessages.length - 1];
    const userQuestion = lastMessage?.content || '';

    // Load conversation history for this PDF
    const conversationHistory = await prisma.message.findMany({
      where: { userId: auth.uid, pdfId: latestPdf.id },
      orderBy: { createdAt: 'asc' },
      select: { role: true, content: true }
    });

    // Only include PDF chunks on the first message
    let pdfContext = '';
    if (isFirstMessage) {
      const relevantChunks = latestPdf.chunks.slice(0, 10); // Limit to first 10 chunks to avoid token limits
      pdfContext = relevantChunks
        .map((chunk, index) => `[Chunk ${index + 1}${chunk.pageNumber ? ` - Page ${chunk.pageNumber}` : ''}]: ${chunk.content}`)
        .join('\n\n');
      console.log(`Including ${relevantChunks.length} PDF chunks in first message`);
    } else {
      console.log(`Skipping PDF chunks for follow-up message (using conversation history)`);
    }

    // Create smart system message based on whether this is first message
    const systemMessage = {
      role: 'system' as const,
      content: isFirstMessage 
        ? `You are a helpful AI assistant that answers questions based on the provided PDF document. 

PDF Content:
${pdfContext}

Instructions:
- Answer questions based only on the provided PDF content
- If information is not in the PDF, clearly state that
- If the user asks for related information from the pdf content, give a brief answer from your knowledge and clearly mention it is not mentioned in the pdf provided
- Remember this PDF content for our entire conversation
- When answering, please format your response as:
- Answer: [your response]
- Page number: [page X]

IMPORTANT: Do NOT include the "Source text:" field in your response. Only provide the Answer and Page number.`
        : `Continue our conversation about the PDF document. Answer questions based on the PDF content provided earlier in this conversation. If you need to reference specific information, refer back to the PDF content from our conversation history.`
    };

    // Convert conversation history to message format
    const historyMessages = conversationHistory.map(msg => ({
      role: msg.role as 'user' | 'assistant' | 'system',
      content: msg.content
    }));

    // Build complete message array: system + history + new messages
    const allMessages = [systemMessage, ...historyMessages, ...validMessages];
    const coreMessages = allMessages.map(msg => ({
      role: msg.role,
      content: msg.content
    }));

    // Store user message in database
    await prisma.message.create({
      data: {
        content: userQuestion,
        role: 'user',
        userId: auth.uid,
        pdfId: latestPdf.id,
      },
    });

    // Check if API key is configured
    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    console.log('Chat API - API Key status:', apiKey ? 'Present' : 'Missing');
    
    if (!apiKey) {
      console.error('GOOGLE_GENERATIVE_AI_API_KEY is missing from environment variables');
      return NextResponse.json(
        { 
          error: 'GOOGLE_GENERATIVE_AI_API_KEY environment variable is not configured.',
          instructions: 'Add GOOGLE_GENERATIVE_AI_API_KEY to your .env file'
        },
        { status: 500 }
      );
    }
    
    console.log('Chat API - API Key length:', apiKey.length);
    console.log('Chat API - API Key first 10 chars:', apiKey.substring(0, 10) + '...');

    // Generate AI response  
    const result = await streamText({
      model: google('gemini-2.5-flash'),
      messages: coreMessages,
    });
    console.log('result', result);
    // Store assistant response in database (we'll need to collect the full response)
    let assistantResponse = '';
    const responseStream = new ReadableStream({
      async start(controller) {
        for await (const chunk of result.textStream) {
          assistantResponse += chunk;
          controller.enqueue(new TextEncoder().encode(chunk));
        }
        
        // Store the complete assistant response
        await prisma.message.create({
          data: {
            content: assistantResponse,
            role: 'assistant',
            userId: auth.uid,
            pdfId: latestPdf.id,
          },
        });
        
        controller.close();
      },
    });

    return new Response(responseStream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
      },
    });

  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET endpoint to fetch chat history for the current PDF
export async function GET(req: NextRequest) {
  try {
    const auth = await readAuthFromRequest(req);
    if (!auth?.uid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get the latest PDF for this user
    const latestPdf = await prisma.pdf.findFirst({
      where: { userId: auth.uid },
      orderBy: { createdAt: 'desc' },
    });

    if (!latestPdf) {
      return NextResponse.json({ messages: [] });
    }

    // Get all messages for this PDF
    const messages = await prisma.message.findMany({
      where: {
        userId: auth.uid,
        pdfId: latestPdf.id,
      },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        content: true,
        role: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ messages });

  } catch (error) {
    console.error('Get chat history error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
