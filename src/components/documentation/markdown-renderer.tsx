"use client";

import ReactMarkdown from "react-markdown";
// @ts-ignore — no type declarations for this style module
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import SyntaxHighlighter from "react-syntax-highlighter/dist/esm/prism";

interface MarkdownRendererProps {
  content: string;
}

export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  return (
    <div className="doc-markdown">
      <ReactMarkdown
        components={{
          h1: ({ children }) => (
            <h1 className="doc-md-h1">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="doc-md-h2">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="doc-md-h3">{children}</h3>
          ),
          h4: ({ children }) => (
            <h4 className="doc-md-h4">{children}</h4>
          ),
          p: ({ children }) => (
            <p className="doc-md-p">{children}</p>
          ),
          ul: ({ children }) => (
            <ul className="doc-md-ul">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="doc-md-ol">{children}</ol>
          ),
          li: ({ children }) => (
            <li className="doc-md-li">{children}</li>
          ),
          blockquote: ({ children }) => (
            <blockquote className="doc-md-blockquote">{children}</blockquote>
          ),
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer" className="doc-md-link">
              {children}
            </a>
          ),
          code: ({ className, children, ...props }) => {
            const match = /language-(\w+)/.exec(className || "");
            const isInline = !match;
            if (isInline) {
              return <code className="doc-md-inline-code">{children}</code>;
            }
            return (
              <SyntaxHighlighter
                style={oneDark}
                language={match[1]}
                PreTag="div"
                className="doc-md-code-block"
              >
                {String(children).replace(/\n$/, "")}
              </SyntaxHighlighter>
            );
          },
          table: ({ children }) => (
            <div className="doc-md-table-wrap">
              <table className="doc-md-table">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="doc-md-thead">{children}</thead>,
          tbody: ({ children }) => <tbody className="doc-md-tbody">{children}</tbody>,
          th: ({ children }) => <th className="doc-md-th">{children}</th>,
          td: ({ children }) => <td className="doc-md-td">{children}</td>,
          hr: () => <hr className="doc-md-hr" />,
          img: ({ src, alt }) => (
            <img src={src} alt={alt || ""} className="doc-md-img" loading="lazy" />
          ),
          strong: ({ children }) => <strong className="doc-md-strong">{children}</strong>,
          em: ({ children }) => <em>{children}</em>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}