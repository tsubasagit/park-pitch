import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface MarkdownRendererProps {
  content: string
}

export default function MarkdownRenderer({ content }: MarkdownRendererProps) {
  return (
    <div
      className="
        prose prose-sm max-w-none
        prose-p:my-1 prose-headings:my-2 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5
        prose-table:my-2
        prose-hr:my-3
        prose-blockquote:my-2 prose-blockquote:border-pitch-navy/30
        prose-code:bg-gray-200 prose-code:rounded prose-code:px-1 prose-code:py-0.5 prose-code:text-xs prose-code:before:content-none prose-code:after:content-none
        prose-pre:bg-gray-800 prose-pre:text-gray-100 prose-pre:rounded-md prose-pre:text-xs
        prose-th:py-1 prose-th:px-2 prose-td:py-1 prose-td:px-2
        prose-a:text-pitch-orange prose-a:no-underline hover:prose-a:underline
        prose-strong:text-pitch-navy
      "
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  )
}
