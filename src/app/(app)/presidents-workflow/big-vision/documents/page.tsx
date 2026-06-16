'use client'
// src/app/(app)/presidents-workflow/big-vision/documents/page.tsx
//
// Documents & Files — file list + upload zone (ported from Phase 3), now living on
// its own sub-page inside the shared VisionSubPageShell.

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import VisionSubPageShell from '../_components/VisionSubPageShell'

interface FileRow {
  id: string
  name: string
  url: string | null
  uploaded_at: string
  uploaded_by: string | null
}

// Supabase Storage bucket for vision documents.
// TODO: confirm cask-vision-docs bucket exists in Supabase Storage before enabling upload
const VISION_DOCS_BUCKET = 'cask-vision-docs'

const UPLOAD_ACCEPT =
  '.pdf,.docx,.png,.jpg,.jpeg,.gif,.webp,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/*'

function formatFileDate(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function FileIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ color: 'var(--text3)', flexShrink: 0 }}
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  )
}

function UploadCloudIcon() {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ color: 'var(--text3)', opacity: 0.7 }}
    >
      <path d="M16 16l-4-4-4 4" />
      <path d="M12 12v9" />
      <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" />
      <path d="M16 16l-4-4-4 4" />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flexShrink: 0 }}
    >
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  )
}

export default function DocumentsPage() {
  const [files, setFiles] = useState<FileRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const [dragActive, setDragActive] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [uploadSuccess, setUploadSuccess] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const loadFiles = useCallback(async () => {
    setLoading(true)
    setError(false)
    const supabase = createClient()
    const { data, error: fetchError } = await supabase
      .from('cask_vision_files')
      .select('id, name, url, uploaded_at, uploaded_by')
      .order('uploaded_at', { ascending: false })
    if (fetchError) {
      setError(true)
    } else {
      setFiles((data as FileRow[]) ?? [])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    loadFiles()
  }, [loadFiles])

  async function handleFile(file: File | undefined) {
    if (!file || uploading) return
    setUploading(true)
    setUploadError('')
    setUploadSuccess('')
    try {
      const supabase = createClient()
      // Unique path to avoid collisions on duplicate file names.
      const path = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`

      // TODO: confirm cask-vision-docs bucket exists in Supabase Storage before enabling upload
      const { error: uploadErr } = await supabase.storage.from(VISION_DOCS_BUCKET).upload(path, file)
      if (uploadErr) throw uploadErr

      const { data: pub } = supabase.storage.from(VISION_DOCS_BUCKET).getPublicUrl(path)
      const url = pub?.publicUrl ?? null

      const { error: insertErr } = await supabase.from('cask_vision_files').insert({
        name: file.name,
        url,
        uploaded_at: new Date().toISOString(),
        uploaded_by: 'Calin Noonan',
      })
      if (insertErr) throw insertErr

      setUploadSuccess(`"${file.name}" uploaded successfully.`)
      await loadFiles()
    } catch {
      setUploadError('Upload failed. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragActive(false)
    handleFile(e.dataTransfer.files?.[0])
  }

  async function handleDelete(file: FileRow) {
    if (deletingId) return
    if (!window.confirm(`Delete ${file.name}? This cannot be undone.`)) return
    setDeletingId(file.id)
    setDeleteError('')
    try {
      const supabase = createClient()
      const { error: deleteErr } = await supabase.from('cask_vision_files').delete().eq('id', file.id)
      if (deleteErr) throw deleteErr
      await loadFiles()
    } catch {
      setDeleteError(`Failed to delete "${file.name}". Please try again.`)
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <VisionSubPageShell title="Documents & Files" subtitle="Source documents and reference materials">
      {/* File list */}
      {error ? (
        <div
          className="text-[13px]"
          style={{
            color: 'var(--text3)',
            border: '1px solid var(--fable-line, var(--border))',
            borderRadius: 'var(--fable-radius)',
            background: 'var(--surface)',
            padding: '16px 20px',
          }}
        >
          Unable to load documents.
        </div>
      ) : loading ? (
        <div className="flex flex-col gap-2.5">
          {[0, 1, 2].map((i) => (
            <div key={i} className="shimmer" style={{ height: 56, borderRadius: 'var(--fable-radius)' }} />
          ))}
        </div>
      ) : (
        <div
          style={{
            border: '1px solid var(--fable-line, var(--border))',
            borderRadius: 'var(--fable-radius)',
            background: 'var(--surface)',
            overflow: 'hidden',
          }}
        >
          {files.length === 0 ? (
            <div style={{ padding: '20px', fontSize: 13, color: 'var(--text3)', textAlign: 'center' }}>
              No documents yet.
            </div>
          ) : (
            files.map((f, i) => (
              <div
                key={f.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  padding: '14px 18px',
                  borderBottom:
                    i < files.length - 1 ? '1px solid var(--fable-line-soft, var(--border))' : 'none',
                }}
              >
                <FileIcon />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div
                    style={{
                      fontSize: 13.5,
                      fontWeight: 600,
                      color: 'var(--text)',
                      letterSpacing: '-0.1px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {f.name}
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 2 }}>
                    {formatFileDate(f.uploaded_at)}
                    {f.uploaded_by ? ` · ${f.uploaded_by}` : ''}
                  </div>
                </div>
                {f.url ? (
                  <a
                    href={f.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      flexShrink: 0,
                      fontSize: 12,
                      fontWeight: 550,
                      padding: '6px 14px',
                      borderRadius: 7,
                      border: '1px solid var(--fable-line, var(--border))',
                      background: 'var(--surface)',
                      color: 'var(--text)',
                      textDecoration: 'none',
                      transition: 'border-color 150ms ease',
                    }}
                  >
                    View
                  </a>
                ) : (
                  <button
                    type="button"
                    disabled
                    title="No file URL available"
                    style={{
                      flexShrink: 0,
                      fontSize: 12,
                      fontWeight: 550,
                      padding: '6px 14px',
                      borderRadius: 7,
                      border: '1px solid var(--fable-line, var(--border))',
                      background: 'var(--surface)',
                      color: 'var(--text3)',
                      cursor: 'not-allowed',
                      opacity: 0.5,
                      fontFamily: 'inherit',
                    }}
                  >
                    View
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleDelete(f)}
                  disabled={deletingId === f.id}
                  title={`Delete ${f.name}`}
                  aria-label={`Delete ${f.name}`}
                  style={{
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 30,
                    height: 30,
                    borderRadius: 7,
                    border: '1px solid var(--fable-line, var(--border))',
                    background: 'var(--surface)',
                    color: '#b91c1c',
                    cursor: deletingId === f.id ? 'not-allowed' : 'pointer',
                    opacity: deletingId === f.id ? 0.5 : 1,
                    fontFamily: 'inherit',
                    transition: 'border-color 150ms ease, background 150ms ease',
                  }}
                >
                  <TrashIcon />
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {deleteError && (
        <div style={{ marginTop: 10, fontSize: 12, color: '#b91c1c' }}>{deleteError}</div>
      )}

      {/* Upload zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setDragActive(true)
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={onDrop}
        style={{
          marginTop: 12,
          border: `1.5px dashed ${dragActive ? 'var(--fable-red)' : 'var(--border)'}`,
          borderRadius: 'var(--fable-radius)',
          background: dragActive ? 'var(--surface2)' : 'var(--surface)',
          padding: '26px 20px',
          textAlign: 'center',
          transition: 'border-color 150ms ease, background 150ms ease',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
          <UploadCloudIcon />
        </div>
        <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 10 }}>
          Drag &amp; drop a file here, or
        </div>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          style={{
            fontSize: 12.5,
            fontWeight: 550,
            padding: '8px 16px',
            borderRadius: 7,
            background: 'var(--charcoal)',
            border: '1px solid var(--charcoal)',
            color: '#fff',
            cursor: uploading ? 'not-allowed' : 'pointer',
            opacity: uploading ? 0.6 : 1,
            fontFamily: 'inherit',
            transition: 'opacity 150ms ease',
          }}
        >
          Browse files
        </button>
        <input
          ref={inputRef}
          type="file"
          accept={UPLOAD_ACCEPT}
          style={{ display: 'none' }}
          onChange={(e) => {
            handleFile(e.target.files?.[0])
            e.target.value = '' // allow re-selecting the same file
          }}
        />
        <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 10 }}>
          Accepted: PDF, DOCX, images
        </div>

        {/* Upload status */}
        {uploading && <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 12 }}>Uploading…</div>}
        {!uploading && uploadSuccess && (
          <div style={{ fontSize: 12, color: '#15803d', marginTop: 12 }}>{uploadSuccess}</div>
        )}
        {!uploading && uploadError && (
          <div style={{ fontSize: 12, color: '#b91c1c', marginTop: 12 }}>{uploadError}</div>
        )}
      </div>
    </VisionSubPageShell>
  )
}
