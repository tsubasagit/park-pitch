import { useState, useCallback, useEffect, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Proposal } from '../types'
import { updateProposal } from '../api/client'
import { htmlToMarkdown } from '../lib/htmlToMarkdown'

interface SlidePresentationProps {
  proposal: Proposal
  onNew?: () => void
  embedded?: boolean
  onProposalUpdated?: (proposal: Proposal) => void
}

export default function SlidePresentation({
  proposal,
  onProposalUpdated,
}: SlidePresentationProps) {
  const initialPages = proposal.markdownContent
    .split(/\n---\n/)
    .map((s) => s.trim())
    .filter(Boolean)

  const [pages, setPages] = useState(initialPages)
  const [editingSlide, setEditingSlide] = useState<number | null>(null)
  const [currentSlide, setCurrentSlide] = useState(0)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const slideRefs = useRef<(HTMLDivElement | null)[]>([])
  const editableRefs = useRef<(HTMLDivElement | null)[]>([])

  const totalSlides = pages.length

  // Sync when proposal changes externally
  useEffect(() => {
    const newPages = proposal.markdownContent
      .split(/\n---\n/)
      .map((s) => s.trim())
      .filter(Boolean)
    setPages(newPages)
    setDirty(false)
    setEditingSlide(null)
  }, [proposal.id, proposal.markdownContent])

  // IntersectionObserver
  useEffect(() => {
    const container = scrollRef.current
    if (!container) return
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const idx = Number(entry.target.getAttribute('data-slide-index'))
            if (!isNaN(idx)) setCurrentSlide(idx)
          }
        }
      },
      { root: container, threshold: 0.5 },
    )
    slideRefs.current.forEach((el) => { if (el) observer.observe(el) })
    return () => observer.disconnect()
  }, [pages.length])

  const scrollToSlide = useCallback((index: number) => {
    slideRefs.current[index]?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [])

  // Start editing — copy rendered HTML into contentEditable div
  const startEdit = (index: number) => {
    // Grab the rendered HTML from the read-mode div before switching
    const slideEl = slideRefs.current[index]
    const readDiv = slideEl?.querySelector('[data-read-content]')
    const html = readDiv?.innerHTML || ''
    setEditingSlide(index)
    requestAnimationFrame(() => {
      const el = editableRefs.current[index]
      if (el) {
        el.innerHTML = html
        el.focus()
        const sel = window.getSelection()
        if (sel) {
          sel.selectAllChildren(el)
          sel.collapseToEnd()
        }
      }
    })
  }

  // Finish editing — convert HTML back to markdown
  const finishEdit = (index: number) => {
    const el = editableRefs.current[index]
    if (!el) {
      setEditingSlide(null)
      return
    }
    const newMarkdown = htmlToMarkdown(el)
    if (newMarkdown !== pages[index]) {
      const newPages = [...pages]
      newPages[index] = newMarkdown
      setPages(newPages)
      setDirty(true)
    }
    setEditingSlide(null)
  }

  // Reorder slides
  const moveSlide = (index: number, direction: -1 | 1) => {
    const target = index + direction
    if (target < 0 || target >= pages.length) return
    const newPages = [...pages]
    ;[newPages[index], newPages[target]] = [newPages[target], newPages[index]]
    setPages(newPages)
    setDirty(true)
    setTimeout(() => scrollToSlide(target), 100)
  }

  const deleteSlide = (index: number) => {
    if (pages.length <= 1) return
    if (!confirm(`スライド ${index + 1} を削除しますか？`)) return
    setPages(pages.filter((_, i) => i !== index))
    setDirty(true)
    if (editingSlide === index) setEditingSlide(null)
  }

  const saveChanges = async () => {
    setSaving(true)
    try {
      const markdown = pages.join('\n\n---\n\n')
      const updated = await updateProposal(proposal.id, markdown)
      setDirty(false)
      onProposalUpdated?.(updated)
    } catch {
      // ignore
    } finally {
      setSaving(false)
    }
  }

  // Fullscreen
  useEffect(() => {
    if (!isFullscreen) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsFullscreen(false)
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [isFullscreen])

  if (isFullscreen) {
    return <FullscreenMode pages={pages} proposal={proposal} onExit={() => setIsFullscreen(false)} />
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {pages.map((page, i) => {
          const isCover = i === 0
          const isEditing = editingSlide === i

          return (
            <div
              key={i}
              ref={(el) => { slideRefs.current[i] = el }}
              data-slide-index={i}
              className="mx-auto group relative"
              style={{ maxWidth: '900px' }}
            >
              {/* Hover toolbar — minimal */}
              <div className="absolute -top-5 right-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                <button
                  type="button"
                  onClick={() => moveSlide(i, -1)}
                  disabled={i === 0}
                  className="p-0.5 text-gray-400 hover:text-gray-600 disabled:opacity-20 rounded hover:bg-white/80"
                  title="上に移動"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => moveSlide(i, 1)}
                  disabled={i === pages.length - 1}
                  className="p-0.5 text-gray-400 hover:text-gray-600 disabled:opacity-20 rounded hover:bg-white/80"
                  title="下に移動"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => deleteSlide(i)}
                  disabled={pages.length <= 1}
                  className="p-0.5 text-gray-400 hover:text-red-600 disabled:opacity-20 rounded hover:bg-white/80"
                  title="削除"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>

              {/* Slide card */}
              <div
                className={`w-full rounded-xl overflow-hidden flex flex-col transition-shadow ${
                  isEditing ? 'shadow-xl ring-2 ring-pitch-navy/40' : 'shadow-lg cursor-pointer hover:ring-2 hover:ring-pitch-navy/20'
                } ${
                  isCover
                    ? 'bg-gradient-to-br from-pitch-navy via-pitch-navyLight to-pitch-navy text-white'
                    : 'bg-white'
                }`}
                style={{ aspectRatio: '16 / 9' }}
                onClick={() => { if (!isEditing) startEdit(i) }}
              >
                <div
                  className={`flex-1 overflow-auto flex items-center ${
                    isCover ? 'justify-center text-center px-10 py-8' : 'px-10 py-8'
                  }`}
                >
                  {isEditing ? (
                    /* contentEditable — direct PowerPoint-like editing */
                    <div
                      ref={(el) => { editableRefs.current[i] = el }}
                      contentEditable
                      suppressContentEditableWarning
                      onBlur={() => finishEdit(i)}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') {
                          e.preventDefault()
                          ;(e.target as HTMLElement).blur()
                        }
                      }}
                      className={`w-full outline-none ${
                        isCover
                          ? 'slide-cover slide-editable'
                          : 'slide-body slide-editable prose prose-sm max-w-none prose-headings:text-pitch-navy prose-strong:text-pitch-navy prose-a:text-pitch-navy'
                      }`}
                    />
                  ) : (
                    /* Read mode */
                    <div
                      data-read-content
                      className={`w-full ${
                        isCover
                          ? 'slide-cover'
                          : 'slide-body prose prose-sm max-w-none prose-headings:text-pitch-navy prose-strong:text-pitch-navy prose-a:text-pitch-navy'
                      }`}
                    >
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{page}</ReactMarkdown>
                    </div>
                  )}
                </div>

                {/* Slide footer */}
                <div
                  className={`shrink-0 px-8 py-2 flex items-center justify-between text-[10px] ${
                    isCover ? 'text-white/40' : 'text-gray-300 border-t border-gray-100'
                  }`}
                >
                  <span>{proposal.clientName} 向け提案書</span>
                  <span>{i + 1} / {totalSlides}</span>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Bottom bar */}
      <div className="shrink-0 flex items-center justify-between px-4 py-2 bg-white border-t border-gray-200 print:hidden">
        <div className="flex items-center gap-1.5">
          {pages.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => scrollToSlide(i)}
              className={`w-6 h-1 rounded-full transition-all ${
                i === currentSlide ? 'bg-pitch-navy' : 'bg-gray-300 hover:bg-gray-400'
              }`}
            />
          ))}
        </div>
        <div className="flex items-center gap-2">
          {dirty && (
            <button
              type="button"
              onClick={saveChanges}
              disabled={saving}
              className="px-3 py-1 rounded text-xs font-medium bg-pitch-orange text-white hover:opacity-90 disabled:opacity-50"
            >
              {saving ? '保存中...' : '変更を保存'}
            </button>
          )}
          <span className="text-xs text-gray-400">{currentSlide + 1} / {totalSlides}</span>
          <button
            type="button"
            onClick={() => setIsFullscreen(true)}
            className="px-3 py-1 rounded text-xs font-medium bg-pitch-navy text-white hover:opacity-90"
          >
            全画面
          </button>
        </div>
      </div>
    </div>
  )
}

/** Fullscreen single-slide presenter mode */
function FullscreenMode({
  pages,
  proposal,
  onExit,
}: {
  pages: string[]
  proposal: Proposal
  onExit: () => void
}) {
  const [current, setCurrent] = useState(0)
  const total = pages.length
  const next = useCallback(() => setCurrent((c) => Math.min(c + 1, total - 1)), [total])
  const prev = useCallback(() => setCurrent((c) => Math.max(c - 1, 0)), [])

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); next() }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); prev() }
      else if (e.key === 'Escape') onExit()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [next, prev, onExit])

  const isCover = current === 0

  return (
    <div className="fixed inset-0 z-50 bg-gray-900 flex flex-col">
      <div className="flex items-center justify-between px-6 py-3 bg-gray-900/80 text-white">
        <span className="text-sm text-gray-400">{current + 1} / {total}</span>
        <button type="button" onClick={onExit} className="px-3 py-1.5 rounded text-xs font-medium bg-white/10 text-white hover:bg-white/20">
          ESC 終了
        </button>
      </div>
      <div className="flex-1 flex items-center justify-center p-8">
        <button type="button" onClick={prev} disabled={current === 0} className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 disabled:opacity-20">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        </button>
        <div className="mx-4 w-full max-w-5xl" style={{ aspectRatio: '16 / 9' }}>
          <div className={`w-full h-full rounded-xl overflow-hidden shadow-2xl flex flex-col ${isCover ? 'bg-gradient-to-br from-pitch-navy via-pitch-navyLight to-pitch-navy text-white' : 'bg-white'}`}>
            <div className={`flex-1 overflow-auto flex items-center ${isCover ? 'justify-center text-center px-12 py-8' : 'px-12 py-8'}`}>
              <div className={`w-full ${isCover ? 'slide-cover' : 'slide-body prose prose-base max-w-none prose-headings:text-pitch-navy prose-strong:text-pitch-navy prose-a:text-pitch-navy'}`}>
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{pages[current]}</ReactMarkdown>
              </div>
            </div>
            <div className={`shrink-0 px-10 py-3 flex items-center justify-between text-xs ${isCover ? 'text-white/40' : 'text-gray-300 border-t border-gray-100'}`}>
              <span>{proposal.clientName} 向け提案書</span>
              <span>{new Date(proposal.createdAt).toLocaleDateString('ja-JP')}</span>
            </div>
          </div>
        </div>
        <button type="button" onClick={next} disabled={current === total - 1} className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 disabled:opacity-20">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
        </button>
      </div>
      <div className="shrink-0 flex items-center justify-center gap-2 py-3 bg-gray-900/80">
        {pages.map((_, i) => (
          <button key={i} type="button" onClick={() => setCurrent(i)} className={`w-8 h-1.5 rounded-full transition-all ${i === current ? 'bg-white' : 'bg-white/30 hover:bg-white/50'}`} />
        ))}
      </div>
    </div>
  )
}
