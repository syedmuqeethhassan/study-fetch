"use client";

// Removed useChat import as we're using direct API calls
import { useEffect, useState } from 'react';

interface ChatMessage {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  createdAt: string;
}

export default function Chat() {
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [input, setInput] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load chat history function
  const loadChatHistory = async () => {
    try {
      const response = await fetch('/api/chat', {
        method: 'GET',
        credentials: 'include',
      });
      
      if (response.ok) {
        const data = await response.json();
        setChatHistory(data.messages);
      }
    } catch (error) {
      console.error('Failed to load chat history:', error);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  // Load chat history on component mount
  useEffect(() => {
    loadChatHistory();

    // Listen for PDF upload events to refresh chat
    const handlePdfUpload = () => {
      // Clear chat history and reload
      setChatHistory([]);
      setIsLoadingHistory(true);
      loadChatHistory();
    };

    window.addEventListener('pdfUploaded', handlePdfUpload);
    
    return () => {
      window.removeEventListener('pdfUploaded', handlePdfUpload);
    };
  }, []);

  if (isLoadingHistory) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-blue-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Chat Header */}
      <div className="bg-white border-b border-gray-200 p-4">
        <div className="flex items-center gap-2">
          <span className="text-xl">🤖</span>
          <h2 className="text-lg font-semibold text-gray-800">PDF Chat Assistant</h2>
        </div>
        <p className="text-sm text-gray-600 mt-1">Ask questions about your uploaded PDF</p>
      </div>

      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {chatHistory.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <span className="text-4xl mb-4">🤖</span>
            <h3 className="text-lg font-medium mb-2">Start a conversation</h3>
            <p className="text-sm text-center max-w-sm">
              Ask me anything about your PDF document. I'll help you find answers based on the content.
            </p>
          </div>
        ) : (
          // Use only database messages as single source of truth
          chatHistory.map((message: any) => (
            <div
              key={message.id}
              className={`flex gap-3 ${
                message.role === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              {message.role === 'assistant' && (
                <div className="flex-shrink-0">
                  <span className="text-2xl">🤖</span>
                </div>
              )}
              
              <div
                className={`max-w-[80%] rounded-lg px-4 py-2 ${
                  message.role === 'user'
                    ? 'bg-blue-600 text-white ml-auto'
                    : 'bg-white text-gray-800 border border-gray-200'
                }`}
              >
                <p className="whitespace-pre-wrap">{message.content}</p>
              </div>

              {message.role === 'user' && (
                <div className="flex-shrink-0">
                  <span className="text-2xl">👤</span>
                </div>
              )}
            </div>
          ))
        )}

        {/* Loading indicator */}
        {isSubmitting && (
          <div className="flex gap-3 justify-start">
            <div className="flex-shrink-0">
              <span className="text-2xl">🤖</span>
            </div>
            <div className="bg-white text-gray-800 border border-gray-200 rounded-lg px-4 py-2">
              <span>Thinking...</span>
            </div>
          </div>
        )}
      </div>

      {/* Input Form */}
      <div className="bg-white border-t border-gray-200 p-4">
        <form onSubmit={async (e) => {
          e.preventDefault();
          if (input.trim()) {
            setIsSubmitting(true);
            try {
              // Send message directly to API instead of using useChat
              const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                  messages: [{ role: 'user', content: input }]
                })
              });

              if (!response.ok) {
                throw new Error('Failed to send message');
              }

              // Read the streaming response
              const reader = response.body?.getReader();
              if (reader) {
                while (true) {
                  const { done } = await reader.read();
                  if (done) break;
                  // We could display streaming here if needed
                }
              }

              setInput('');
              // Reload chat history to show the complete conversation
              loadChatHistory();
            } catch (error) {
              console.error('Failed to send message:', error);
            } finally {
              setIsSubmitting(false);
            }
          }
        }} className="flex gap-2">
          <input
            value={input}
            placeholder="Ask a question about your PDF..."
            onChange={(e) => setInput(e.target.value)}
            disabled={isSubmitting}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
          />
          <button
            type="submit"
            disabled={isSubmitting || !input.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {isSubmitting ? "..." : "Send"}
          </button>
        </form>
        <p className="text-xs text-gray-500 mt-2">
          Responses are based on your uploaded PDF content
        </p>
      </div>
    </div>
  );
}