'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Loader2, CheckCircle, ExternalLink } from 'lucide-react'

interface VerifyInfo {
  item_id: string
  name: string
  board_id: string | null
  board_name: string | null
  group_id: string | null
  group_title: string | null
  status: string | null
}

interface SendToMondayDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  experimentId: string
  experimentName: string
  mondayItemId: string
  summary: string
  strategyContent: string
  designContent: string
  copyContent: string
  onSent: () => void
}

export function SendToMondayDialog({
  open,
  onOpenChange,
  experimentId,
  experimentName,
  mondayItemId,
  summary,
  strategyContent,
  designContent,
  copyContent,
  onSent,
}: SendToMondayDialogProps) {
  const [step, setStep] = useState<'verify' | 'sending' | 'done'>('verify')
  const [verify, setVerify] = useState<VerifyInfo | null>(null)
  const [verifyError, setVerifyError] = useState<string | null>(null)
  const [sendError, setSendError] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !mondayItemId) return
    setStep('verify')
    setVerify(null)
    setVerifyError(null)
    setSendError(null)
    fetch(`/api/feedback/verify-monday?item_id=${encodeURIComponent(mondayItemId)}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setVerifyError(d.error)
        else setVerify(d)
      })
      .catch(() => setVerifyError('Failed to load item'))
  }, [open, mondayItemId])

  const handleConfirm = async () => {
    setStep('sending')
    setSendError(null)
    try {
      const res = await fetch('/api/feedback/send-to-monday', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ experiment_id: experimentId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to send')
      setStep('done')
      onSent()
    } catch (e) {
      setSendError(e instanceof Error ? e.message : 'Failed to send')
    }
  }

  const preview = [
    summary && `Summary: ${summary.slice(0, 120)}${summary.length > 120 ? '…' : ''}`,
    strategyContent && 'Strategy feedback included',
    designContent && 'Design feedback included',
    copyContent && 'Copy feedback included',
  ].filter(Boolean)

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={() => onOpenChange(false)} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="send-monday-title"
        className="relative z-10 w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-lg"
      >
        <div className="space-y-4">
          <div>
            <h2 id="send-monday-title" className="text-lg font-semibold">Send to Monday</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Verify the target item and confirm to push consolidated feedback.
            </p>
          </div>

        {step === 'verify' && (
          <>
            {verifyError && (
              <p className="text-sm text-destructive">{verifyError}</p>
            )}
            {verify && (
              <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm space-y-1">
                <p><span className="text-muted-foreground">Item:</span> {verify.name}</p>
                {verify.board_name && (
                  <p><span className="text-muted-foreground">Board:</span> {verify.board_name}</p>
                )}
                {verify.group_title && (
                  <p><span className="text-muted-foreground">Group:</span> {verify.group_title}</p>
                )}
                {verify.status != null && (
                  <p><span className="text-muted-foreground">Status:</span> {verify.status}</p>
                )}
              </div>
            )}
            <div className="text-xs text-muted-foreground">
              <p className="font-medium text-foreground mb-1">Preview:</p>
              <ul className="list-disc list-inside space-y-0.5">
                {preview.map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ul>
            </div>
          </>
        )}

        {step === 'sending' && (
          <div className="flex items-center gap-3 py-4">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <p className="text-sm">Creating Monday Doc and updating item…</p>
          </div>
        )}

        {step === 'done' && (
          <div className="py-4 text-center">
            <CheckCircle className="h-12 w-12 text-emerald-500 mx-auto mb-2" />
            <p className="text-sm font-medium">Sent to Monday</p>
            <p className="text-xs text-muted-foreground mt-1">Feedback doc and summary have been updated.</p>
            {verify?.board_id && (
              <a
                href={`https://monday.com/boards/${verify.board_id}/pulses/${mondayItemId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 mt-3 text-xs text-primary hover:underline"
              >
                Open item <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        )}

          {sendError && (
            <p className="text-sm text-destructive">{sendError}</p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            {step === 'verify' && (
              <>
                <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                <Button onClick={handleConfirm} disabled={!verify}>
                  Confirm and send
                </Button>
              </>
            )}
            {step === 'sending' && (
              <Button disabled><Loader2 className="h-4 w-4 animate-spin" /></Button>
            )}
            {step === 'done' && (
              <Button onClick={() => onOpenChange(false)}>Close</Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
