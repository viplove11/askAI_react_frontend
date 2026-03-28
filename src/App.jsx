import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { chat as chatQuery } from "./apiService/chatQuery";

const INITIAL_MESSAGES = [
  {
    id: 1,
    role: "assistant",
    text: "Welcome! This is Ask you Data. Ask any question about your database, and I'll help you with answers, SQL, and data insights.",
    time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    markdown: true,
  },
];

const SUGGESTIONS = [
  "Show me pending payments summary",
  "List all properties with overdue taxes",
  "What is the total tax collected this month?",
  "Show payment history for Property ID 7",
];

function TypingDots() {
  return (
    <div className="flex items-center gap-1 py-1 px-1">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-2 h-2 rounded-full bg-slate-400 animate-bounce"
          style={{ animationDelay: `${i * 0.15}s`, animationDuration: "0.8s" }}
        />
      ))}
    </div>
  );
}

function Message({ msg }) {
  const isUser = msg.role === "user";
  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : "flex-row"} items-end`}
      style={{ animation: "fadeUp 0.25s ease forwards" }}>
      {!isUser && (
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center flex-shrink-0 shadow-sm">
          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
          </svg>
        </div>
      )}
      <div className={`flex flex-col gap-1 max-w-[72%] ${isUser ? "items-end" : "items-start"}`}>
        <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-line ${
          isUser
            ? "bg-indigo-500 text-white rounded-br-sm shadow-sm"
            : "bg-white text-slate-700 border border-slate-100 rounded-bl-sm shadow-sm"
        }`}>
          {msg.markdown ? (
            <div className="chat-markdown">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.text}</ReactMarkdown>
            </div>
          ) : (
            msg.text
          )}
        </div>
        <span className="text-xs text-slate-400 px-1">{msg.time}</span>
      </div>
    </div>
  );
}

export default function App() {
  const [messages, setMessages] = useState(INITIAL_MESSAGES);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [streamedText, setStreamedText] = useState("");
  const [streaming, setStreaming] = useState(false);
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping, streamedText]);

  const now = () =>
    new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  // Instant display for markdown answer (no streaming)
  const streamMarkdown = (fullText) => {
    setStreaming(false);
    setStreamedText(fullText);
    setMessages((prev) => [
      ...prev.slice(0, -1),
      {
        ...prev[prev.length - 1],
        text: fullText,
        markdown: true,
      },
    ]);
  };

  const send = async (text) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    setMessages((prev) => [
      ...prev,
      { id: Date.now(), role: "user", text: trimmed, time: now() },
    ]);
    setIsTyping(true);

    // Add a placeholder assistant message for streaming
    setMessages((prev) => [
      ...prev,
      {
        id: Date.now() + 1,
        role: "assistant",
        text: "",
        time: now(),
        markdown: true,
      },
    ]);
    setStreamedText("");
    setStreaming(true);

    try {
      const result = await chatQuery(trimmed);
      const answer = result?.answer || "Sorry, I couldn't get an answer.";
      const intent = result?.intent || null;
      const reportUrl = result?.report_url || null;
      streamMarkdown(answer);
      // Attach intent and report_url to the last assistant message
      setMessages((prev) => [
        ...prev.slice(0, -1),
        {
          ...prev[prev.length - 1],
          text: answer,
          markdown: true,
          intent,
          reportUrl,
        },
      ]);
    } catch (err) {
      setStreaming(false);
      setMessages((prev) => [
        ...prev.slice(0, -1),
        {
          id: Date.now() + 2,
          role: "assistant",
          text: "Sorry, there was an error processing your request.",
          time: now(),
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  };

  const handleInput = (e) => {
    setInput(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 128) + "px";
  };

  const showSuggestions = messages.length <= 2 && !isTyping && !streaming;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600&display=swap');
        * { font-family: 'Instrument Sans', sans-serif; }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        textarea::-webkit-scrollbar { display: none; }
        .messages-scroll::-webkit-scrollbar { width: 4px; }
        .messages-scroll::-webkit-scrollbar-track { background: transparent; }
        .messages-scroll::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 99px; }

        /* Markdown Table Styling */
        .chat-markdown table {
          width: 100%;
          border-collapse: collapse;
          margin: 0.5em 0;
          font-size: 0.97em;
        }
        .chat-markdown th,
        .chat-markdown td {
          border: 1px solid #cbd5e1;
          padding: 6px 10px;
          text-align: left;
        }
        .chat-markdown th {
          background: #f1f5f9;
          font-weight: 600;
        }
        .chat-markdown tr:nth-child(even) td {
          background: #f8fafc;
        }
        .chat-markdown {
          overflow-x: auto;
        }
        .chat-markdown code {
          background: #f3f4f6;
          padding: 2px 4px;
          border-radius: 4px;
          font-size: 0.95em;
        }
        .chat-markdown pre {
          background: #f3f4f6;
          padding: 10px;
          border-radius: 6px;
          overflow-x: auto;
        }
      `}</style>

      <div className="flex flex-col h-screen bg-slate-50">

        {/* Header */}
        <header className="bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between"
          style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center shadow-sm">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
              </svg>
            </div>
            <div>
              <h1 className="text-sm font-semibold text-slate-800">AI Assistant</h1>
              <p className="text-xs text-emerald-500 font-medium flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block"></span>
                Online
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
            </button>
            <button className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 12.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 18.75a.75.75 0 110-1.5.75.75 0 010 1.5z" />
              </svg>
            </button>
          </div>
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-6 messages-scroll">
          <div className="max-w-2xl mx-auto w-full flex flex-col gap-5">

            <div className="text-center">
              <span className="text-xs text-slate-400 font-medium uppercase tracking-widest bg-slate-100 px-3 py-1 rounded-full">Today</span>
            </div>

            {messages.map((msg, idx) => {
              // If this is the last assistant message and streaming, show streamedText
              if (
                idx === messages.length - 1 &&
                msg.role === "assistant" &&
                streaming
              ) {
                return (
                  <Message
                    key={msg.id}
                    msg={{
                      ...msg,
                      text: streamedText,
                      markdown: true,
                    }}
                  />
                );
              }
              return <Message key={msg.id} msg={msg} />;
            })}

            {/* Report Button: Only show if latest assistant message has intent === "report" */}
            {(() => {
              const lastMsg = messages[messages.length - 1];
              if (
                lastMsg &&
                lastMsg.role === "assistant" &&
                lastMsg.intent === "report" &&
                lastMsg.reportUrl
              ) {
                return (
                  <div className="flex justify-end mt-2">
                    <a
                      href={lastMsg.reportUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block px-4 py-2 bg-emerald-500 text-white rounded-lg shadow hover:bg-emerald-600 transition-colors text-sm font-medium"
                    >
                      Download Report
                    </a>
                  </div>
                );
              }
              return null;
            })()}

            {isTyping && !streaming && (
              <div className="flex gap-3 items-end" style={{ animation: "fadeUp 0.25s ease forwards" }}>
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center flex-shrink-0 shadow-sm">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                  </svg>
                </div>
                <div className="bg-white border border-slate-100 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
                  <TypingDots />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Suggestions */}
        {showSuggestions && (
          <div className="px-4 pb-3">
            <div className="max-w-2xl mx-auto flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="text-xs px-3 py-1.5 rounded-full bg-white border border-slate-200 text-slate-500 hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50 transition-all shadow-sm cursor-pointer"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input */}
        <div className="bg-white border-t border-slate-100 px-4 py-4"
          style={{ boxShadow: "0 -1px 3px rgba(0,0,0,0.04)" }}>
          <div className="max-w-2xl mx-auto">
            <div className="flex items-end gap-3 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 transition-all focus-within:border-indigo-300 focus-within:bg-white"
              style={{ transition: "all 0.2s" }}>
              <textarea
                ref={textareaRef}
                rows={1}
                className="flex-1 bg-transparent text-sm text-slate-700 placeholder-slate-400 resize-none outline-none leading-relaxed"
                placeholder="Ask me anything about your database..."
                value={input}
                onChange={handleInput}
                onKeyDown={handleKey}
                disabled={isTyping || streaming}
              />
              <div className="flex items-center gap-2 flex-shrink-0">
                <button className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors rounded-lg hover:bg-slate-100 cursor-pointer" tabIndex={-1}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" />
                  </svg>
                </button>
                <button
                  onClick={() => send(input)}
                  disabled={!input.trim() || isTyping || streaming}
                  className="w-8 h-8 rounded-xl bg-indigo-500 hover:bg-indigo-600 disabled:bg-slate-200 disabled:cursor-not-allowed flex items-center justify-center transition-all hover:shadow-md active:scale-95 cursor-pointer"
                >
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5L12 3m0 0l7.5 7.5M12 3v18" />
                  </svg>
                </button>
              </div>
            </div>
            <p className="text-center text-xs text-slate-400 mt-2">
              Press{" "}
              <kbd className="px-1 py-0.5 bg-slate-100 border border-slate-200 rounded text-slate-500 text-[10px]">Enter</kbd>
              {" "}to send ·{" "}
              <kbd className="px-1 py-0.5 bg-slate-100 border border-slate-200 rounded text-slate-500 text-[10px]">Shift+Enter</kbd>
              {" "}for new line
            </p>
          </div>
        </div>

      </div>
    </>
  );
}