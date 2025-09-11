/**
 * Utility functions for PDF text highlighting based on LLM responses
 */

export interface HighlightInfo {
  pageNumber: number;
  sourceText: string;
  searchText: string; // Cleaned text for searching
}

/**
 * Parses an LLM response to extract page number and source text for highlighting
 * Expected format:
 * - Source text: '[exact quote from PDF]'
 * - Page number: [page X]
 */
export function parseHighlightInfo(response: string): HighlightInfo | null {
  try {
    // Extract page number - look for "Page number:" followed by page info
    const pageMatch = response.match(/Page number:\s*(?:page\s*)?(\d+)/i);
    if (!pageMatch) {
      console.log('No page number found in response');
      return null;
    }

    const pageNumber = parseInt(pageMatch[1], 10);

    // Since we no longer have source text, we'll use the answer content for navigation
    // Extract the answer part - everything before "Page number:"
    const answerMatch = response.match(/Answer:\s*([^]*?)(?=Page number:|$)/i);
    let sourceText = '';
    
    if (answerMatch) {
      // Use the first sentence of the answer as source text for navigation
      sourceText = answerMatch[1]
        .trim()
        .split(/[.!?\n]/)[0] // Take first sentence
        .trim();
    }

    // If no answer found, use a portion of the response
    if (!sourceText) {
      sourceText = response.substring(0, 100); // Use first 100 characters
    }

    // Clean the source text for better searching
    const searchText = sourceText
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/[""'']/g, '"') // Normalize quotes
      .trim();

    console.log('Parsed highlight info:', { pageNumber, sourceText, searchText });

    return {
      pageNumber,
      sourceText,
      searchText
    };
  } catch (error) {
    console.error('Error parsing highlight info:', error);
    return null;
  }
}

/**
 * Interface for highlight areas that can be passed to the PDF viewer
 */
export interface HighlightArea {
  id: string;
  pageIndex: number;
  height: number;
  left: number;
  top: number;
  width: number;
  content: string;
}

/**
 * Creates a search function that can be used with the PDF viewer to find and highlight text
 */
export function createTextHighlighter(highlightInfo: HighlightInfo) {
  return {
    pageNumber: highlightInfo.pageNumber,
    searchText: highlightInfo.searchText,
    originalText: highlightInfo.sourceText,
    
    // Function to check if text matches (with fuzzy matching)
    matches: (text: string): boolean => {
      const normalizedText = text
        .replace(/\s+/g, ' ')
        .replace(/[""'']/g, '"')
        .trim()
        .toLowerCase();
      
      const normalizedSearch = highlightInfo.searchText.toLowerCase();
      
      // Try exact match first
      if (normalizedText.includes(normalizedSearch)) {
        return true;
      }
      
      // Try word-by-word matching for better results
      const searchWords = normalizedSearch.split(' ').filter(w => w.length > 2);
      const textWords = normalizedText.split(' ');
      
      if (searchWords.length === 0) return false;
      
      // Check if most important words are present
      const foundWords = searchWords.filter(word => 
        textWords.some(textWord => textWord.includes(word) || word.includes(textWord))
      );
      
      return foundWords.length >= Math.ceil(searchWords.length * 0.7); // 70% word match threshold
    }
  };
}

/**
 * Creates a highlight area for the PDF viewer based on source text and page number
 * Uses the search functionality to find and highlight the actual text
 */
export function createHighlightFromResponse(response: string): HighlightArea | null {
  const highlightInfo = parseHighlightInfo(response);
  if (!highlightInfo) {
    return null;
  }

  // Clean the search text - take only the first line/sentence and keep only actual text characters
  let cleanedSearchText = highlightInfo.sourceText
    .replace(/([a-z])([A-Z])/g, '$1 $2') // Add spaces between camelCase words like "Speedwith" -> "Speed with"
    .split(/[.!?\n]/)[0] // Take only first sentence/line
    .replace(/[^a-zA-Z0-9\s]/g, ' ') // Keep ONLY letters, numbers, and spaces
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
  
  // Use only the first three distinctive words
  const words = cleanedSearchText.split(' ').filter(word => word.length > 2); // Filter out very short words
  cleanedSearchText = words.slice(0, 3).join(' '); // Use 3 words

  console.log('Original source text:', highlightInfo.sourceText);
  console.log('Using first line for search:', cleanedSearchText);

  // Create highlight area with cleaned search text
  const highlightArea: HighlightArea = {
    id: `highlight-${Date.now()}`,
    pageIndex: highlightInfo.pageNumber - 1, // PDF viewer uses 0-based page index
    height: 2, // Will be determined by search plugin
    left: 10, // Will be determined by search plugin
    top: 20, // Will be determined by search plugin
    width: 80, // Will be determined by search plugin
    content: cleanedSearchText, // Use cleaned text for search
  };

  return highlightArea;
}



/**
 * Function to programmatically highlight text in PDF based on LLM response
 * This function can be called from React components to trigger highlighting
 */
export function highlightTextFromResponse(
  response: string,
  onHighlightCreated?: (highlight: HighlightArea) => void
): HighlightArea | null {
  const highlight = createHighlightFromResponse(response);
  
  if (highlight && onHighlightCreated) {
    onHighlightCreated(highlight);
  }
  
  return highlight;
}
