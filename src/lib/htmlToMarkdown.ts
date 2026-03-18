/** Lightweight HTML → Markdown converter for slide editing */
export function htmlToMarkdown(el: HTMLElement): string {
  return convertNode(el).trim()
}

function convertNode(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent || ''
  }

  if (node.nodeType !== Node.ELEMENT_NODE) return ''

  const el = node as HTMLElement
  const tag = el.tagName.toLowerCase()
  const children = Array.from(el.childNodes).map(convertNode).join('')

  switch (tag) {
    case 'h1': return `# ${children.trim()}\n\n`
    case 'h2': return `## ${children.trim()}\n\n`
    case 'h3': return `### ${children.trim()}\n\n`
    case 'h4': return `#### ${children.trim()}\n\n`
    case 'p': return `${children.trim()}\n\n`
    case 'br': return '\n'
    case 'strong':
    case 'b': return `**${children.trim()}**`
    case 'em':
    case 'i': return `*${children.trim()}*`
    case 'ul': return `${children}\n`
    case 'ol': return `${convertOl(el)}\n`
    case 'li': {
      const isOrdered = el.parentElement?.tagName.toLowerCase() === 'ol'
      const prefix = isOrdered ? '1. ' : '- '
      return `${prefix}${children.trim()}\n`
    }
    case 'a': {
      const href = el.getAttribute('href') || ''
      return `[${children.trim()}](${href})`
    }
    case 'table': return convertTable(el) + '\n\n'
    case 'div': return `${children}\n`
    case 'blockquote': {
      const lines = children.trim().split('\n').map((l) => `> ${l}`).join('\n')
      return `${lines}\n\n`
    }
    default: return children
  }
}

function convertOl(ol: HTMLElement): string {
  return Array.from(ol.children)
    .map((li, i) => {
      const content = Array.from(li.childNodes).map(convertNode).join('')
      return `${i + 1}. ${content.trim()}\n`
    })
    .join('')
}

function convertTable(table: HTMLElement): string {
  const rows: string[][] = []
  table.querySelectorAll('tr').forEach((tr) => {
    const cells: string[] = []
    tr.querySelectorAll('th, td').forEach((cell) => {
      cells.push((cell.textContent || '').trim())
    })
    rows.push(cells)
  })

  if (rows.length === 0) return ''

  const colCount = Math.max(...rows.map((r) => r.length))
  const lines: string[] = []

  rows.forEach((row, i) => {
    const padded = Array.from({ length: colCount }, (_, j) => row[j] || '')
    lines.push(`| ${padded.join(' | ')} |`)
    if (i === 0) {
      lines.push(`| ${padded.map(() => '---').join(' | ')} |`)
    }
  })

  return lines.join('\n')
}
