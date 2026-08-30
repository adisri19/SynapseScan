'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useAppStore } from '../../lib/store';

interface ChatMessage {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  timestamp: string;
}

export function ChatBot() {
  const { currentRunId, dashboardData } = useAppStore();
  const [isOpen, setIsOpen] = useState(false);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome-1',
      sender: 'bot',
      text: "👋 Hi! I'm **SynapseScan Copilot** powered by **Groq (llama-3.3-70b)**.\n\nAsk me anything — codebase audit questions, any programming concept, debugging help, career advice, or general knowledge. I answer it all.",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  // Handle sending a message
  const handleSendMessage = async (customText?: string) => {
    const textToSend = customText || inputMessage;
    if (!textToSend.trim() || isLoading) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!customText) setInputMessage('');
    setIsLoading(true);

    try {
      const activeRunId = currentRunId || dashboardData?.run?.id || null;

      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: textToSend,
          runId: activeRunId,
          messages: [...messages, userMsg].map(m => ({ role: m.sender, content: m.text }))
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch AI response');
      }

      const botMsg: ChatMessage = {
        id: `bot-${Date.now()}`,
        sender: 'bot',
        text: data.text || 'I analyzed your request, but received an empty response.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setMessages((prev) => [...prev, botMsg]);
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: `bot-err-${Date.now()}`,
        sender: 'bot',
        text: `⚠️ **Error**: ${err?.message || 'Failed to connect to AI assistant.'}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  // Quick suggestion buttons
  const suggestions = [
    'What should I fix first?',
    'Which files are grade F?',
    'How do I reduce nesting depth in JS?',
    'Explain async/await simply',
    'What are the SOLID principles?',
    'Write a TypeScript debounce function',
  ];

  // Helper renderer for lightweight markdown formatted response text
  const renderFormattedText = (text: string) => {
    // Process ``` code blocks first
    if (text.includes('```')) {
      const codeBlockParts = text.split(/(```[\s\S]*?```)/g);
      return codeBlockParts.map((part, blockIdx) => {
        if (part.startsWith('```') && part.endsWith('```')) {
          const lines = part.slice(3, -3).trim().split('\n');
          // Check if first line is language identifier
          const firstLine = lines[0]?.trim() || '';
          const isLangHeader = /^[a-zA-Z0-9_-]+$/.test(firstLine);
          const codeContent = isLangHeader ? lines.slice(1).join('\n') : lines.join('\n');

          return (
            <div key={blockIdx} className="my-2 rounded-lg bg-[#0B0F17] border border-[#1F2937] overflow-hidden max-w-full">
              {isLangHeader && (
                <div className="bg-[#111827] px-3 py-1 border-b border-[#1F2937] text-[10px] font-mono text-emerald-400 font-semibold uppercase tracking-wider">
                  {firstLine}
                </div>
              )}
              <pre className="p-2.5 text-[11px] font-mono text-slate-200 overflow-x-auto max-w-full custom-scrollbar whitespace-pre leading-relaxed break-all">
                <code>{codeContent}</code>
              </pre>
            </div>
          );
        }
        return <React.Fragment key={blockIdx}>{renderMarkdownLines(part)}</React.Fragment>;
      });
    }

    return renderMarkdownLines(text);
  };

  const renderMarkdownLines = (text: string) => {
    const lines = text.split('\n');
    return lines.map((line, idx) => {
      // Header 3
      if (line.startsWith('### ')) {
        return <h3 key={idx} className="text-sm font-bold text-emerald-400 mt-2 mb-1 break-words break-all">{line.replace('### ', '')}</h3>;
      }
      // Header 4
      if (line.startsWith('#### ')) {
        return <h4 key={idx} className="text-xs font-bold text-emerald-300 mt-2 mb-1 break-words break-all">{line.replace('#### ', '')}</h4>;
      }
      // Blockquote
      if (line.startsWith('> ')) {
        return <p key={idx} className="text-xs italic text-amber-300/90 bg-amber-500/10 border-l-2 border-amber-500 px-2 py-1 my-1 rounded-r break-words break-all">{line.replace('> ', '')}</p>;
      }
      // Bullet list item
      if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
        const itemContent = line.trim().substring(2);
        return (
          <li key={idx} className="text-xs text-slate-200 ml-3 list-disc my-0.5 break-words break-all">
            {formatBoldAndCode(itemContent)}
          </li>
        );
      }
      // Numbered list item
      if (/^\d+\.\s/.test(line.trim())) {
        return (
          <li key={idx} className="text-xs text-slate-200 ml-3 list-decimal my-0.5 break-words break-all">
            {formatBoldAndCode(line.trim().replace(/^\d+\.\s/, ''))}
          </li>
        );
      }
      // Empty line
      if (!line.trim()) {
        return <div key={idx} className="h-1.5" />;
      }
      // Regular text
      return (
        <p key={idx} className="text-xs text-slate-200 leading-relaxed my-0.5 break-words break-all">
          {formatBoldAndCode(line)}
        </p>
      );
    });
  };

  // Helper to format **bold** and `code` inline
  const formatBoldAndCode = (str: string) => {
    const parts = str.split(/(\*\*.*?\*\*|`.*?`)/g);
    return parts.map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={index} className="font-semibold text-white break-words break-all">{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        return <code key={index} className="bg-slate-800 text-emerald-400 px-1 py-0.5 rounded font-mono text-[11px] break-words break-all max-w-full inline whitespace-pre-wrap">{part.slice(1, -1)}</code>;
      }
      return part;
    });
  };

  const currentRepoName = dashboardData?.repository ? `${dashboardData.repository.owner}/${dashboardData.repository.name}` : null;

  return (
    <div className="fixed bottom-5 right-5 z-50 font-sans">
      {/* Floating launcher button when chat is closed */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="bg-[#111827] border border-[#10B981]/40 hover:border-[#10B981] text-white px-4 py-3 rounded-full shadow-2xl flex items-center gap-3 transition-all duration-300 hover:scale-105 active:scale-95 group relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-[#10B981]/10 via-transparent to-[#10B981]/10 opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="w-8 h-8 rounded-full bg-[#10B981]/20 border border-[#10B981]/40 flex items-center justify-center text-[#10B981]">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <div className="text-left">
            <span className="block text-xs font-bold text-white leading-tight">AI Assistant</span>
            <span className="block text-[10px] text-[#10B981] font-mono leading-tight flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-pulse" />
              Ask Copilot
            </span>
          </div>
        </button>
      )}

      {/* Expanded Chatbot Modal / Panel */}
      {isOpen && (
        <div className="w-[360px] sm:w-[420px] h-[520px] bg-[#111827] border border-[#1F2937] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-5 duration-200">
          {/* Header */}
          <div className="bg-[#0B0F17] border-b border-[#1F2937] p-3.5 px-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#10B981]/15 border border-[#10B981]/30 flex items-center justify-center text-[#10B981]">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-bold text-white font-sans">SynapseScan Copilot</h3>
                  <span className="w-2 h-2 rounded-full bg-[#10B981] status-dot" />
                </div>
                {currentRepoName ? (
                  <span className="text-[10px] font-mono text-[#10B981] truncate max-w-[180px] block">
                    {currentRepoName}
                  </span>
                ) : (
                  <span className="text-[10px] font-mono text-slate-400 block">
                    Global Code Quality AI
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setMessages([{
                  id: 'welcome-reset',
                  sender: 'bot',
                  text: 'Chat cleared. Ask me anything about your code quality audit!',
                  timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                }])}
                title="Clear Chat"
                className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
              <button
                onClick={() => setIsOpen(false)}
                title="Minimize"
                className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Messages Body */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3.5 custom-scrollbar bg-[#0B0F17]/60 min-w-0">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'} min-w-0 max-w-full`}
              >
                <div
                  className={`max-w-[88%] rounded-2xl p-3 shadow-md min-w-0 overflow-hidden break-words ${
                    msg.sender === 'user'
                      ? 'bg-[#10B981] text-white rounded-br-none font-sans text-xs'
                      : 'bg-[#182232] border border-[#2A374A] text-slate-200 rounded-bl-none font-sans text-xs'
                  }`}
                >
                  {msg.sender === 'bot' ? (
                    <div className="space-y-1 min-w-0 max-w-full overflow-hidden">{renderFormattedText(msg.text)}</div>
                  ) : (
                    <p className="leading-relaxed whitespace-pre-wrap break-words">{msg.text}</p>
                  )}
                </div>
                <span className="text-[9px] font-mono text-slate-500 mt-1 px-1">
                  {msg.timestamp}
                </span>
              </div>
            ))}

            {isLoading && (
              <div className="flex items-start gap-2">
                <div className="bg-[#182232] border border-[#2A374A] rounded-2xl rounded-bl-none p-3 shadow-md flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-bounce" />
                  <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-bounce [animation-delay:0.2s]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-bounce [animation-delay:0.4s]" />
                  <span className="text-[11px] font-mono text-slate-400 ml-1">Analyzing codebase...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Suggestions Pills */}
          <div className="bg-[#0B0F17] px-3 py-2 border-t border-[#1F2937] flex gap-1.5 overflow-x-auto custom-scrollbar shrink-0">
            {suggestions.map((s, idx) => (
              <button
                key={idx}
                onClick={() => handleSendMessage(s)}
                disabled={isLoading}
                className="shrink-0 bg-[#111827] hover:bg-[#10B981]/15 text-slate-300 hover:text-[#10B981] border border-[#1F2937] hover:border-[#10B981]/40 rounded-full px-2.5 py-1 text-[10px] font-mono transition disabled:opacity-50"
              >
                {s}
              </button>
            ))}
          </div>

          {/* Input Form */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="p-3 bg-[#111827] border-t border-[#1F2937] flex gap-2 items-center"
          >
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder={currentRepoName
                ? `Ask about ${currentRepoName} or anything...`
                : 'Ask me anything — code, concepts, or advice...'}
              disabled={isLoading}
              className="flex-1 bg-[#0B0F17] border border-[#1F2937] text-white placeholder-slate-500 rounded-xl px-3.5 py-2.5 text-xs font-sans focus:border-[#10B981] focus:ring-1 focus:ring-[#10B981] outline-none transition disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={isLoading || !inputMessage.trim()}
              className="bg-[#10B981] hover:bg-emerald-400 active:bg-emerald-600 disabled:bg-slate-800 disabled:text-slate-600 text-slate-950 p-2.5 rounded-xl transition duration-150 flex items-center justify-center shrink-0"
            >
              <svg className="w-4 h-4 text-slate-950 font-bold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
export default ChatBot;
