/**
 * Example usage of the PDF highlighting functionality
 * This file demonstrates how to use the highlighting functions
 */

import { parseHighlightInfo, highlightTextFromResponse, HighlightArea } from './pdfHighlight';

/**
 * Example of how to highlight text programmatically
 */
export function exampleHighlightUsage() {
  // Example LLM response with source text and page number
  const llmResponse = `
Answer: The microwave operates using electromagnetic waves to heat food.

Source text: 'Microwave ovens use electromagnetic radiation at a frequency of 2.45 GHz to heat food by exciting water molecules.'

Page number: page 15
  `;

  // Parse the response to extract highlight information
  const highlightInfo = parseHighlightInfo(llmResponse);
  
  if (highlightInfo) {
    console.log('Parsed highlight info:', highlightInfo);
    // Output: { pageNumber: 15, sourceText: '...', searchText: '...' }
    
    // Create a highlight area and trigger highlighting
    const highlight = highlightTextFromResponse(llmResponse, (highlightArea: HighlightArea) => {
      console.log('Highlight created:', highlightArea);
      
      // In a React component, you could dispatch an event or update state here
      // For example:
      // setHighlights(prev => [...prev, highlightArea]);
      // or
      // window.dispatchEvent(new CustomEvent('highlightText', { detail: highlightArea }));
    });
    
    return highlight;
  }
  
  return null;
}

/**
 * Function that can be called from React components to highlight text
 */
export function highlightFromChatMessage(messageContent: string): boolean {
  const highlight = highlightTextFromResponse(messageContent, (highlightArea) => {
    // Dispatch event to notify PDF viewer
    window.dispatchEvent(new CustomEvent('highlightText', {
      detail: highlightArea
    }));
  });
  
  return highlight !== null;
}
