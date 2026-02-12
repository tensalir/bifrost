import { getQueueStats, getAllJobs } from '@/lib/kv'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { FileText, CheckCircle2, XCircle, Clock, Activity } from 'lucide-react'

function getEnvStatus() {
  return {
    monday: !!process.env.MONDAY_API_TOKEN,
    figma: !!process.env.FIGMA_ACCESS_TOKEN,
    claude: !!process.env.ANTHROPIC_API_KEY,
  }
}

function StatCard({ title, value, icon: Icon }: { title: string; value: number; icon: React.ElementType }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  )
}

function StatusBadge({ state }: { state: string }) {
  const variants = {
    queued: 'default',
    running: 'secondary',
    completed: 'default',
    failed: 'destructive',
  } as const

  return <Badge variant={variants[state as keyof typeof variants] || 'outline'}>{state}</Badge>
}

export default async function DashboardPage() {
  const stats = await getQueueStats()
  const recentJobs = (await getAllJobs(10)).slice(0, 10)
  const envStatus = getEnvStatus()

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Monday-to-Figma briefing sync status
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Queued" value={stats.queued} icon={Clock} />
        <StatCard title="Running" value={stats.running} icon={Activity} />
        <StatCard title="Completed" value={stats.completed} icon={CheckCircle2} />
        <StatCard title="Failed" value={stats.failed} icon={XCircle} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent Jobs</CardTitle>
            <CardDescription>Last 10 synced briefings</CardDescription>
          </CardHeader>
          <CardContent>
            {recentJobs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No jobs yet</p>
            ) : (
              <div className="space-y-4">
                {recentJobs.map((job) => (
                  <div
                    key={job.id}
                    className="flex items-center justify-between border-b pb-4 last:border-0"
                  >
                    <div className="space-y-1">
                      <p className="text-sm font-medium">{job.experimentPageName}</p>
                      <p className="text-xs text-muted-foreground">
                        {job.batchCanonical} • {new Date(job.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <StatusBadge state={job.state} />
                  </div>
                ))}
              </div>
            )}
            <div className="mt-4 pt-4 border-t">
              <Link
                href="/jobs"
                className="text-sm font-medium text-primary hover:underline"
              >
                View all jobs →
              </Link>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>System Health</CardTitle>
            <CardDescription>API key status</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Monday API</span>
                {envStatus.monday ? (
                  <Badge variant="default">Connected</Badge>
                ) : (
                  <Badge variant="destructive">Missing</Badge>
                )}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Figma API</span>
                {envStatus.figma ? (
                  <Badge variant="default">Connected</Badge>
                ) : (
                  <Badge variant="destructive">Missing</Badge>
                )}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Claude API</span>
                {envStatus.claude ? (
                  <Badge variant="default">Connected</Badge>
                ) : (
                  <Badge variant="destructive">Missing</Badge>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
