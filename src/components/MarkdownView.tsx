import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/** AI 分析结果 Markdown 渲染（标题/列表/加粗/引用等） */
export default function MarkdownView({ content }: { content: string }) {
  return (
    <div className="text-sm leading-relaxed">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => <h1 className="mb-2 mt-3 text-lg font-bold">{children}</h1>,
          h2: ({ children }) => <h2 className="mb-1.5 mt-3 text-base font-semibold">{children}</h2>,
          h3: ({ children }) => <h3 className="mb-1 mt-2.5 text-sm font-semibold">{children}</h3>,
          p: ({ children }) => <p className="my-1.5">{children}</p>,
          ul: ({ children }) => <ul className="my-1.5 list-disc space-y-0.5 pl-5">{children}</ul>,
          ol: ({ children }) => (
            <ol className="my-1.5 list-decimal space-y-0.5 pl-5">{children}</ol>
          ),
          li: ({ children }) => <li>{children}</li>,
          strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
          em: ({ children }) => <em>{children}</em>,
          blockquote: ({ children }) => (
            <blockquote className="my-2 border-l-2 border-border pl-3 text-muted-foreground">
              {children}
            </blockquote>
          ),
          code: ({ children }) => (
            <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">{children}</code>
          ),
          pre: ({ children }) => (
            <pre className="my-2 overflow-auto rounded-md bg-muted p-3 font-mono text-xs">
              {children}
            </pre>
          ),
          hr: () => <hr className="my-3 border-border" />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
