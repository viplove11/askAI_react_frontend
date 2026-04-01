import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { chat as chatQuery } from "./apiService/chatQuery";
import "./App.css";

// Unique ID generator
let messageIdCounter = 0;
const generateId = () => ++messageIdCounter;

const INITIAL_MESSAGES = [
  {
    id: 1,
    role: "assistant",
    text: "**नमस्ते !** मैं आपका **' सर्वेक्षण सहायक एआई सहायक '** हूँ ।\n\nआप अपने डेटा के बारे में कोई भी सवाल पूछ सकते हैं — हिंदी या अंग्रेज़ी में। मैं आपको उत्तर, महत्वपूर्ण जानकारी (इंसाइट्स) और रिपोर्ट देने में मदद करूँगा ।",
    time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    markdown: true,
  },
];

messageIdCounter = 1; // Start from 2 for new messages

const SUGGESTIONS = [
  "BJP party mein kitne members hain?",
  "Sabhi members ki list dikhao",
  "Ward 4 ke members kaun hain?",
  "Total gaon kitne hai",
  "Total district kitne hai",
];

function TypingDots() {
  return (
    <div className="typing-dots">
      {[0, 1, 2].map((i) => (
        <span key={i} style={{ animationDelay: `${i * 0.18}s` }} />
      ))}
    </div>
  );
}

function IntentBadge({ intent }) {
  if (!intent) return null;
  const map = {
    count:  { label: "Count",  color: "#f97316", bg: "#fff7ed" },
    lookup: { label: "Lookup", color: "#ea580c", bg: "#ffedd5" },
    list:   { label: "List",   color: "#c2410c", bg: "#ffedd5" },
    report: { label: "Report", color: "#9a3412", bg: "#fed7aa" },
  };
  const meta = map[intent];
  if (!meta) return null;
  return (
    <span className="intent-badge" style={{ color: meta.color, background: meta.bg, borderColor: meta.color + "33" }}>
      {meta.label}
    </span>
  );
}

function Message({ msg, isStreaming }) {
  const isUser = msg.role === "user";
  return (
    <div className={`msg-row ${isUser ? "msg-user" : "msg-assistant"}`}>
      {/* {!isUser && (
        <div className="avatar">
          <span className="avatar-label">AI</span>
        </div>
      )} */}

      <div className={`bubble-wrap ${isUser ? "bubble-wrap-user" : ""}`}>
        {/* {!isUser && msg.intent && !isStreaming && (
          <div className="bubble-meta">
            <IntentBadge intent={msg.intent} />
          </div>
        )} */}
        <div className={`bubble ${isUser ? "bubble-user" : "bubble-ai"}`}>
          {msg.markdown ? (
            <div className="md">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.text || ""}</ReactMarkdown>
            </div>
          ) : (
            <span>{msg.text}</span>
          )}
          {isStreaming && <span className="cursor-blink" />}
        </div>

        <div className={`msg-footer ${isUser ? "msg-footer-right" : ""}`}>
          <span className="msg-time">{msg.time}</span>
          {!isUser && msg.reportUrl && !isStreaming && (
            <a href={msg.reportUrl} target="_blank" rel="noopener noreferrer" className="dl-btn">
              <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
              Download Report
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [messages, setMessages]   = useState(INITIAL_MESSAGES);
  const [input, setInput]         = useState("");
  const [isTyping, setIsTyping]   = useState(false);
  const [streaming, setStreaming] = useState(false);
  const bottomRef   = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const now = () =>
    new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  const getStreamDelay = (text, targetMs = 6500, minDelay = 12, maxDelay = 55) => {
    const len = Math.max(text?.length || 0, 1);
    const calculated = Math.round(targetMs / len);
    return Math.max(minDelay, Math.min(maxDelay, calculated));
  };

  const streamText = (fullText, placeholderId, charDelay) => {
    const safeText = fullText || "";
    return new Promise((resolve) => {
      let currentIndex = 0;
      const interval = setInterval(() => {
        if (currentIndex <= safeText.length) {
          const displayText = safeText.slice(0, currentIndex);
          setMessages((prev) =>
            prev.map((m) => (m.id === placeholderId ? { ...m, text: displayText } : m))
          );
          currentIndex++;
        } else {
          clearInterval(interval);
          resolve();
        }
      }, charDelay);
    });
  };

  const send = async (text) => {
    const trimmed = text.trim();
    if (!trimmed || isTyping || streaming) return;

    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    // Add user message
    setMessages((prev) => [
      ...prev,
      { id: generateId(), role: "user", text: trimmed, time: now(), markdown: false },
    ]);
    setIsTyping(true);

    // Placeholder assistant bubble
    const placeholderId = generateId();
    setMessages((prev) => [
      ...prev,
      { id: placeholderId, role: "assistant", text: "", time: now(), markdown: true },
    ]);
    setStreaming(true);

    try {
      const result = await chatQuery(trimmed);
      const answer = result?.answer || "Sorry, I couldn't get an answer.";
      const intent = result?.intent || null;
      const reportUrl = result?.report_url || null;

      // Update metadata, then stream response with dynamic speed based on content length.
      setMessages((prev) =>
        prev.map((m) =>
          m.id === placeholderId ? { ...m, intent, reportUrl, time: now() } : m
        )
      );
      await streamText(answer, placeholderId, getStreamDelay(answer));
    } catch (error) {
      const errorMsg = "⚠️ There was an error processing your request. Please try again.";
      await streamText(errorMsg, placeholderId, getStreamDelay(errorMsg, 2200, 10, 35));
    } finally {
      setIsTyping(false);
      setStreaming(false);
    }
  };

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); }
  };

  const handleInput = (e) => {
    setInput(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 140) + "px";
  };

  const showSuggestions = messages.length <= 2 && !isTyping && !streaming;

  return (
    <>
      <div className="app">

        {/* ── Header ── */}
        <header className="header">
          <div className="header-left">
            <div className="header-avatar">
              <span className="avatar-label">AI</span>
            </div>
            <div>
              <div className="header-title">Sarvekshan Sahayak AI Assistant</div>
              <div className="header-status">
                <span className="status-dot" />
                Online
              </div>
            </div>
          </div>
          <div className="header-actions">
          </div>
        </header>

        {/* ── Messages ── */}
        <div className="messages">
          <div className="date-divider">Today</div>

          {messages.map((msg, idx) => {
            const isLastAssistant =
              idx === messages.length - 1 && msg.role === "assistant" && streaming;
            return (
              <Message key={msg.id} msg={msg} isStreaming={isLastAssistant} />
            );
          })}

          {/* Typing indicator — shown only when waiting and no placeholder yet */}
          {isTyping && !streaming && (
            <div className="typing-row" style={{ animation: "fadeUp 0.22s ease forwards" }}>
              <div className="avatar">
                <span className="avatar-label">AI</span>
              </div>
              <TypingDots />
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* ── Suggestions ── */}
        {showSuggestions && (
          <div className="suggestions">
            <div className="suggestions-inner">
              {SUGGESTIONS.map((s) => (
                <button key={s} className="suggestion-chip" onClick={() => send(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Input ── */}
        <div className="input-area">
          <div className="input-box">
            <textarea
              ref={textareaRef}
              rows={1}
              placeholder="Kuch bhi poochein apne database ke baare mein..."
              value={input}
              onChange={handleInput}
              onKeyDown={handleKey}
              disabled={isTyping || streaming}
            />
            <div className="input-actions">
              <button
                className="send-btn"
                onClick={() => send(input)}
                disabled={!input.trim() || isTyping || streaming}
                title="Send"
              >
                <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5L12 3m0 0l7.5 7.5M12 3v18" />
                </svg>
              </button>
            </div>
          </div>
          <p className="input-hint">
            <kbd>Enter</kbd> to send &nbsp;·&nbsp; <kbd>Shift+Enter</kbd> for new line
          </p>
        </div>

      </div>
    </>
  );
}
