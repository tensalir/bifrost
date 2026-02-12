'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Save } from 'lucide-react'

type FilterSettings = {
  enforceFilters: boolean
  allowedStatuses: string[]
  allowedTeams: string[]
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<FilterSettings>({
    enforceFilters: false,
    allowedStatuses: [],
    allowedTeams: [],
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      const res = await fetch('/api/settings')
      const data = await res.json()
      setSettings(data.filters || { enforceFilters: false, allowedStatuses: [], allowedTeams: [] })
    } catch (error) {
      console.error('Failed to load settings:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setMessage(null)

    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filters: settings }),
      })

      if (res.ok) {
        setMessage({ type: 'success', text: 'Settings saved successfully' })
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

  const updateArray = (field: 'allowedStatuses' | 'allowedTeams', value: string) => {
    setSettings({
      ...settings,
      [field]: value.split(',').map((s) => s.trim()).filter(Boolean),
    })
  }

  if (loading) {
    return <div className="p-8">Loading...</div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Configure eligibility filters and system behavior
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Eligibility Filters</CardTitle>
          <CardDescription>
            Control which Monday items are queued for Figma sync
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">Enforce Filters</div>
              <div className="text-sm text-muted-foreground">
                Only queue items matching status and team filters
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.enforceFilters}
                onChange={(e) => setSettings({ ...settings, enforceFilters: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
            </label>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Allowed Status Values</label>
            <input
              type="text"
              value={settings.allowedStatuses.join(', ')}
              onChange={(e) => updateArray('allowedStatuses', e.target.value)}
              placeholder="approved, ready for review"
              className="w-full rounded-md border bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <p className="text-xs text-muted-foreground">Comma-separated list</p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Allowed Team Values</label>
            <input
              type="text"
              value={settings.allowedTeams.join(', ')}
              onChange={(e) => updateArray('allowedTeams', e.target.value)}
              placeholder="studio, content creation"
              className="w-full rounded-md border bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <p className="text-xs text-muted-foreground">Comma-separated list</p>
          </div>

          <Button onClick={handleSave} disabled={saving} className="w-full">
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Saving...' : 'Save Settings'}
          </Button>

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
