'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus, Save, Trash2 } from 'lucide-react'

type RoutingEntry = {
  key: string
  value: string
}

export default function RoutingPage() {
  const [entries, setEntries] = useState<RoutingEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    loadRouting()
  }, [])

  const loadRouting = async () => {
    try {
      const res = await fetch('/api/settings')
      const data = await res.json()
      const map = data.routing || {}
      setEntries(Object.entries(map).map(([key, value]) => ({ key, value: String(value) })))
    } catch (error) {
      console.error('Failed to load routing:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setMessage(null)

    const routing = entries.reduce((acc, { key, value }) => {
      if (key && value) acc[key] = value
      return acc
    }, {} as Record<string, string>)

    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ routing }),
      })

      if (res.ok) {
        setMessage({ type: 'success', text: 'Routing map saved successfully' })
      } else {
        const data = await res.json()
        setMessage({ type: 'error', text: data.error || 'Failed to save' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Unknown error' })
    } finally {
      setSaving(false)
    }
  }

  const addEntry = () => {
    setEntries([...entries, { key: '', value: '' }])
  }

  const removeEntry = (index: number) => {
    setEntries(entries.filter((_, i) => i !== index))
  }

  const updateEntry = (index: number, field: 'key' | 'value', value: string) => {
    const updated = [...entries]
    updated[index][field] = value
    setEntries(updated)
  }

  if (loading) {
    return <div className="p-8">Loading...</div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Routing Map</h1>
        <p className="text-muted-foreground">
          Map batch canonical keys to Figma file keys
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Batch → File Key Mapping</CardTitle>
          <CardDescription>
            Format: canonical key (2026-03) → Figma file key
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {entries.map((entry, index) => (
            <div key={index} className="flex gap-2">
              <input
                type="text"
                value={entry.key}
                onChange={(e) => updateEntry(index, 'key', e.target.value)}
                placeholder="2026-03"
                className="flex-1 rounded-md border bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <input
                type="text"
                value={entry.value}
                onChange={(e) => updateEntry(index, 'value', e.target.value)}
                placeholder="Figma file key..."
                className="flex-[2] rounded-md border bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <Button
                variant="destructive"
                size="icon"
                onClick={() => removeEntry(index)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}

          <div className="flex gap-2 pt-4">
            <Button onClick={addEntry} variant="outline" className="flex-1">
              <Plus className="h-4 w-4 mr-2" />
              Add Entry
            </Button>
            <Button onClick={handleSave} disabled={saving} className="flex-1">
              <Save className="h-4 w-4 mr-2" />
              {saving ? 'Saving...' : 'Save Mapping'}
            </Button>
          </div>

          {message && (
            <div
              className={`rounded-md border p-3 text-sm ${
                message.type === 'success'
                  ? 'border-green-500/50 bg-green-500/10 text-green-500'
                  : 'border-red-500/50 bg-red-500/10 text-red-500'
              }`}
            >
              {message.text}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
