'use client';

import { useState, useEffect, useRef } from 'react';
import { Worker, Viewer } from '@react-pdf-viewer/core';
import { defaultLayoutPlugin } from '@react-pdf-viewer/default-layout';
import { highlightPlugin, MessageIcon } from '@react-pdf-viewer/highlight';
import type { RenderHighlightContentProps, RenderHighlightTargetProps } from '@react-pdf-viewer/highlight';
import { searchPlugin } from '@react-pdf-viewer/search';
import type { RenderSearchProps } from '@react-pdf-viewer/search';
import { pageNavigationPlugin } from '@react-pdf-viewer/page-navigation';
import { HighlightArea, parseHighlightInfo } from '@/lib/pdfHighlight';

// Import CSS
import '@react-pdf-viewer/core/lib/styles/index.css';
import '@react-pdf-viewer/default-layout/lib/styles/index.css';
import '@react-pdf-viewer/highlight/lib/styles/index.css';
import '@react-pdf-viewer/search/lib/styles/index.css';
import '@react-pdf-viewer/page-navigation/lib/styles/index.css';

interface PDFViewerProps {
  fileUrl: string;
  highlightAreas?: HighlightArea[];
  onHighlightAdded?: (highlight: HighlightArea) => void;
}

// Fetch the current user's single/most recent PDF URL
export async function fetchLoginPdfUrl(): Promise<string | null> {
  try {
    const res = await fetch('/api/upload', { method: 'GET', credentials: 'include' });
    if (!res.ok) return null;
    return '/api/upload';
  } catch {
    return null;
  }
}

const PdfViewerComponent = ({ fileUrl, highlightAreas = [], onHighlightAdded }: PDFViewerProps) => {
  const [mounted, setMounted] = useState(false);
  const [dynamicHighlights, setDynamicHighlights] = useState<HighlightArea[]>([]);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [targetPage, setTargetPage] = useState<number | null>(null);

  // Create plugins
  const defaultLayoutPluginInstance = defaultLayoutPlugin();
  const pageNavigationPluginInstance = pageNavigationPlugin();
  const { jumpToPage } = pageNavigationPluginInstance;
  
  // Create search plugin instance with custom render and debugging
  const searchPluginInstance = searchPlugin({
    keyword: searchKeyword,
    matchCase: false, // Make search case-insensitive
    wholeWords: false, // Allow partial word matches
    onHighlightKeyword: (props) => {
      console.log('Search plugin found matches:', props);
      console.log('Match details:', {
        keyword: props.keyword,
        numMatches: props.numMatches || 'unknown'
      });
      return (
        <mark
          style={{
            backgroundColor: '#ffff00',
            color: '#000000',
            padding: '2px 4px',
            borderRadius: '2px',
            fontWeight: 'bold',
            border: '1px solid #ffcc00'
          }}
        >
          {props.keyword}
        </mark>
      );
    },
  });
  
  const renderHighlightTarget = (props: RenderHighlightTargetProps) => {
    // Return null to disable the highlight target icon
    return null;
  };

  const renderHighlightContent = (props: RenderHighlightContentProps) => {
    // Return null to disable the popup
    return null;
  };

  // Combine external highlight areas with dynamic ones
  const allHighlights = [...highlightAreas, ...dynamicHighlights];

  const highlightPluginInstance = highlightPlugin({
    areas: allHighlights,
    renderHighlightTarget,
    renderHighlightContent,
  });

  useEffect(() => {
    setMounted(true);

    // Listen for highlight events from the chat component
    const handleHighlightEvent = (event: CustomEvent) => {
      const highlightArea = event.detail;
      console.log('Received highlight event:', highlightArea);
      
      // Extract the original source text from the response
      const response = event.detail.originalResponse;
      let searchText = highlightArea.content;
      
      if (response) {
        const highlightInfo = parseHighlightInfo(response);
        if (highlightInfo) {
          // Use first line/sentence of source text only and keep only actual text characters
          searchText = highlightInfo.sourceText
            .replace(/([a-z])([A-Z])/g, '$1 $2') // Add spaces between camelCase words like "Speedwith" -> "Speed with"
            .split(/[.!?\n]/)[0] // Take only first sentence/line
            .replace(/[^a-zA-Z0-9\s]/g, ' ') // Keep ONLY letters, numbers, and spaces
            .replace(/\s+/g, ' ') // Normalize whitespace
            .trim();
          
          // Use only the first three distinctive words
          const words = searchText.split(' ').filter(word => word.length > 2); // Filter out very short words
          searchText = words.slice(0, 3).join(' '); // Use 3 words
          
          console.log('Using first three terms for search:', searchText);
        }
      }
      
      // Clear previous search and navigate to page
      setSearchKeyword('');
      setTargetPage(highlightArea.pageIndex);
      
      // Navigate to page first
      if (jumpToPage) {
        jumpToPage(highlightArea.pageIndex);
        console.log('Jumped to page:', highlightArea.pageIndex + 1);
      }
      
      // Set search keyword after navigation with fallback strategies
      if (searchText) {
        setTimeout(() => {
          setSearchKeyword(searchText);
          console.log('Search keyword set to:', searchText);
          
          // If no highlighting after 3 seconds, try individual words
          setTimeout(() => {
            if (searchKeyword === searchText) {
              const words = searchText.split(' ').filter(word => word.length > 2);
              if (words.length > 0) {
                console.log('Trying individual word search:', words[0]);
                setSearchKeyword(words[0]);
                
                // Try second word after another 2 seconds if first doesn't work
                setTimeout(() => {
                  if (searchKeyword === words[0] && words.length > 1) {
                    console.log('Trying second word:', words[1]);
                    setSearchKeyword(words[1]);
                    
                    // Last resort: try a very common word to test if search works at all
                    setTimeout(() => {
                      if (searchKeyword === words[1]) {
                        console.log('Last resort: trying simple word "data"');
                        setSearchKeyword('data');
                      }
                    }, 2000);
                  }
                }, 2000);
              }
            }
          }, 3000);
        }, 300);
      }
      
      setDynamicHighlights(prev => [...prev, highlightArea]);
      onHighlightAdded?.(highlightArea);
    };

    window.addEventListener('highlightText', handleHighlightEvent as EventListener);

    return () => {
      window.removeEventListener('highlightText', handleHighlightEvent as EventListener);
    };
  }, [onHighlightAdded, jumpToPage]);



  if (!mounted) {
    return <div className="h-full flex items-center justify-center">Loading...</div>;
  }

  return (
    <Worker workerUrl="https://unpkg.com/pdfjs-dist@3.4.120/build/pdf.worker.min.js">
      <div className="h-full">
        <div className="h-full">
                  <Viewer
          fileUrl={fileUrl}
          plugins={[defaultLayoutPluginInstance, highlightPluginInstance, searchPluginInstance, pageNavigationPluginInstance]}
        />
        </div>
      </div>
    </Worker>
  );
};

export default PdfViewerComponent;