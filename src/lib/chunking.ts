export interface ChunkOptions {
  chunkSize?: number; // Number of characters per chunk
  overlap?: number;   // Number of characters to overlap between chunks
}

export interface TextChunk {
  content: string;
  startIndex: number;
  endIndex: number;
}

/**
 * Splits text into overlapping chunks for better context preservation
 */
export function chunkText(
  text: string, 
  options: ChunkOptions = {}
): TextChunk[] {
  const { chunkSize = 1000, overlap = 200 } = options;
  
  if (text.length <= chunkSize) {
    return [{
      content: text.trim(),
      startIndex: 0,
      endIndex: text.length
    }];
  }

  const chunks: TextChunk[] = [];
  let startIndex = 0;

  while (startIndex < text.length) {
    let endIndex = Math.min(startIndex + chunkSize, text.length);
    
    // Try to break at a sentence boundary if we're not at the end
    if (endIndex < text.length) {
      const nearbyText = text.slice(endIndex - 100, endIndex + 100);
      const sentenceEnd = nearbyText.search(/[.!?]\s+/);
      
      if (sentenceEnd !== -1) {
        // Adjust endIndex to the sentence boundary
        const actualEnd = endIndex - 100 + sentenceEnd + 1;
        if (actualEnd > startIndex + chunkSize * 0.5) { // Don't make chunks too small
          endIndex = actualEnd;
        }
      }
    }

    const chunkContent = text.slice(startIndex, endIndex).trim();
    
    if (chunkContent.length > 0) {
      chunks.push({
        content: chunkContent,
        startIndex,
        endIndex
      });
    }

    // Move to next chunk with overlap
    startIndex = endIndex - overlap;
    
    // Ensure we don't go backwards
    if (startIndex <= chunks[chunks.length - 1]?.startIndex) {
      startIndex = endIndex;
    }
  }

  return chunks;
}

/**
 * Splits text by pages and then chunks each page
 */
export function chunkTextByPages(
  textByPage: string[], 
  options: ChunkOptions = {}
): Array<TextChunk & { pageNumber: number }> {
  const allChunks: Array<TextChunk & { pageNumber: number }> = [];

  textByPage.forEach((pageText, pageIndex) => {
    if (pageText.trim().length === 0) return;
    
    const pageChunks = chunkText(pageText, options);
    
    pageChunks.forEach(chunk => {
      allChunks.push({
        ...chunk,
        pageNumber: pageIndex + 1 // 1-indexed page numbers
      });
    });
  });

  return allChunks;
}
