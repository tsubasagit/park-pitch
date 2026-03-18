import fs from 'fs'
import path from 'path'

const DATA_DIR = path.join(import.meta.dirname, 'data')
const UPLOADS_DIR = path.join(import.meta.dirname, 'uploads')

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

ensureDir(DATA_DIR)
ensureDir(UPLOADS_DIR)

export function getUploadsDir(): string {
  return UPLOADS_DIR
}

function filePath(name: string): string {
  return path.join(DATA_DIR, name)
}

export function readJSON<T>(name: string): T | null {
  const p = filePath(name)
  if (!fs.existsSync(p)) return null
  const raw = fs.readFileSync(p, 'utf-8')
  return JSON.parse(raw) as T
}

export function writeJSON<T>(name: string, data: T): void {
  const p = filePath(name)
  fs.writeFileSync(p, JSON.stringify(data, null, 2), 'utf-8')
}

export function deleteFile(filepath: string): void {
  if (fs.existsSync(filepath)) {
    fs.unlinkSync(filepath)
  }
}
