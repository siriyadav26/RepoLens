"use client";

import { useState, useRef, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Send, Bot, User, Loader2, MessageSquare, Sparkles } from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
  citations?: { file_path: string; similarity: number }[];
}

export default function RepoChatPage() {
  const { id } = useParams<{ id: string }>();
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "Hi! I'm RepoLens AI. Ask me anything about this repository — its structure, code, authentication, API routes, database schema, and more. I can only answer questions related to this repository's indexed files.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [repoName, setRepoName] = useState<string>("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (id) {
      fetch(`/api/repositories/${id}`)
        .then((r) => r.json())
        .then((data) => {
          const repo = data.repository || data;
          if (repo?.full_name) setRepoName(repo.full_name);
        })
        .catch(() => {});
    }
  }, [id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage() {
    const question = input.trim();
    if (!question || loading) return;

    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: question }]);
    setLoading(true);

    try {
      const res = await fetch(`/api/repositories/${id}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });
      const data = await res.json();

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.answer || data.error || "Something went wrong.",
          citations: data.citations,
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Network error — please try again.",
        },
      ]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  return (
    <div className="chat-page">
      {/* Breadcrumb */}
      <nav className="page-breadcrumb">
        <Link href="/dashboard">Dashboard</Link>
        <span className="page-breadcrumb-sep">/</span>
        <Link href="/dashboard/repositories">Repositories</Link>
        {repoName && (
          <>
            <span className="page-breadcrumb-sep">/</span>
            <Link href={`/dashboard/repositories/${id}`}>{repoName}</Link>
          </>
        )}
        <span className="page-breadcrumb-sep">/</span>
        <span className="page-breadcrumb-current">RAG Q&amp;A</span>
      </nav>

      <div className="chat-container">
        {/* Header */}
        <div className="chat-header">
          <div className="chat-header-left">
            <div className="chat-header-icon">
              <Sparkles size={20} />
            </div>
            <div>
              <h1 className="chat-header-title">RAG Q&amp;A</h1>
              {repoName && (
                <p className="chat-header-sub">{repoName}</p>
              )}
            </div>
          </div>
          <div className="chat-header-badge">
            <span className="chat-badge-dot" />
            Repository-Only AI
          </div>
        </div>

        {/* Messages */}
        <div className="chat-messages">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`chat-msg chat-msg--${msg.role}`}
            >
              <div className="chat-msg-avatar">
                {msg.role === "assistant" ? (
                  <Bot size={16} />
                ) : (
                  <User size={16} />
                )}
              </div>
              <div className="chat-msg-bubble">
                <p className="chat-msg-text">{msg.content}</p>
                {msg.citations && msg.citations.length > 0 && (
                  <div className="chat-citations">
                    <p className="chat-citations-label">Sources:</p>
                    {msg.citations.map((c, ci) => (
                      <span key={ci} className="chat-citation-tag">
                        📄 {c.file_path}{" "}
                        <span className="chat-citation-score">
                          ({(c.similarity * 100).toFixed(0)}% match)
                        </span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="chat-msg chat-msg--assistant">
              <div className="chat-msg-avatar">
                <Bot size={16} />
              </div>
              <div className="chat-msg-bubble chat-msg-bubble--loading">
                <Loader2 size={16} className="chat-spinner" />
                <span>Thinking...</span>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="chat-input-wrap">
          <div className="chat-input-box">
            <textarea
              ref={inputRef}
              className="chat-textarea"
              rows={1}
              placeholder="Ask about this repository... (Enter to send, Shift+Enter for newline)"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={loading}
            />
            <button
              className="chat-send-btn"
              onClick={sendMessage}
              disabled={loading || !input.trim()}
              aria-label="Send message"
            >
              {loading ? (
                <Loader2 size={18} className="chat-spinner" />
              ) : (
                <Send size={18} />
              )}
            </button>
          </div>
          <p className="chat-input-hint">
            <MessageSquare size={12} />
            Only answers questions about indexed repository files.
          </p>
        </div>
      </div>
    </div>
  );
}
