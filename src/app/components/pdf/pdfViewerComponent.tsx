'use client';

import { useState, useEffect } from 'react';
import { Worker, Viewer } from '@react-pdf-viewer/core';
import { defaultLayoutPlugin } from '@react-pdf-viewer/default-layout';

// Import CSS
import '@react-pdf-viewer/core/lib/styles/index.css';
import '@react-pdf-viewer/default-layout/lib/styles/index.css';

interface PDFViewerProps {
  fileUrl: string;
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

const PdfViewerComponent = ({ fileUrl }: PDFViewerProps) => {
  const [mounted, setMounted] = useState(false);
  const defaultLayoutPluginInstance = defaultLayoutPlugin();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="h-full flex items-center justify-center">Loading...</div>;
  }

  return (
    <Worker workerUrl="https://unpkg.com/pdfjs-dist@3.4.120/build/pdf.worker.min.js">
      <div className="h-full">
        <Viewer
          fileUrl={fileUrl}
          plugins={[defaultLayoutPluginInstance]}
        />
      </div>
    </Worker>
  );
};

export default PdfViewerComponent;