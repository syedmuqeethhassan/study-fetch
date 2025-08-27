"use client";

import { useEffect, useState } from "react";
import PdfViewerComponent, { fetchLoginPdfUrl } from "./pdfViewerComponent";

export default function PDF() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<string>("");
  const [url, setUrl] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("");
    setUrl("");
    setIsLoading(true);

    if (!file) {
      setStatus("Please select a PDF file");
      setIsLoading(false);
      return;
    }

    const fd = new FormData();
    fd.append("file", file);

    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        body: fd,
      });

      const json = await res.json();

      if (!res.ok) {
        setStatus(json.error || "Upload failed.");
        return;
      }

      setStatus("Uploaded successfully!");
      setUrl(json.url);
    } catch (error) {
      setStatus("Upload failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    let isMounted = true;
    fetchLoginPdfUrl().then((url) => {
      if (isMounted && url) setUrl(url);
    });
    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="w-full h-full flex flex-col p-4">
      {/* Upload Form */}
      <div className="mb-4">
        <form
          onSubmit={onSubmit}
          className="flex flex-col gap-3 md:flex-row md:items-center border-2 border-gray-300 rounded-xl p-3 bg-white"
        >
          <input
            type="file"
            accept="application/pdf"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="block text-sm text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          />
          <button
            type="submit"
            disabled={isLoading || !file}
            className="rounded-xl px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? "Uploading..." : "Upload"}
          </button>
        </form>
        
        {/* {status && (
          <div className={`mt-2 text-sm ${status.includes('successfully') ? 'text-green-600' : 'text-red-600'}`}>
            {status}
          </div>
        )} */}
      </div>

      {/* PDF Viewer */}
      <div className="flex-1 bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {url ? (
          <PdfViewerComponent fileUrl={url} />
        ) : (
          <div className="h-full flex items-center justify-center text-gray-500">
            <div className="text-center">
              <div className="text-4xl mb-2">📄</div>
              <p className="text-lg font-medium">Upload a PDF to get started!</p>
              <p className="text-sm text-gray-400">Select a PDF file and click upload</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}