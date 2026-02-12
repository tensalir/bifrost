import { getAllJobs } from '@/lib/kv'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

function StatusBadge({ state }: { state: string }) {
  const variants = {
    queued: 'default',
    running: 'secondary',
    completed: 'default',
    failed: 'destructive',
  } as const

  return <Badge variant={variants[state as keyof typeof variants] || 'outline'}>{state}</Badge>
}

export default async function JobsPage() {
  const jobs = await getAllJobs(100)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Jobs</h1>
        <p className="text-muted-foreground">
          All briefing sync jobs
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Job Queue</CardTitle>
          <CardDescription>Recent and pending sync jobs</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-4 font-medium">Experiment</th>
                  <th className="text-left p-4 font-medium">Batch</th>
                  <th className="text-left p-4 font-medium">Status</th>
                  <th className="text-left p-4 font-medium">Created</th>
                  <th className="text-left p-4 font-medium">Monday ID</th>
                </tr>
              </thead>
              <tbody>
                {jobs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-4 text-center text-sm text-muted-foreground">
                      No jobs found
                    </td>
                  </tr>
                ) : (
                  jobs.map((job) => (
                    <tr key={job.id} className="border-b last:border-0 hover:bg-accent/50">
                      <td className="p-4">
                        <div className="font-medium">{job.experimentPageName}</div>
                        {job.figmaFileUrl && (
                          <a
                            href={job.figmaFileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-primary hover:underline"
                          >
                            View in Figma
                          </a>
                        )}
                      </td>
                      <td className="p-4 text-sm">{job.batchCanonical}</td>
                      <td className="p-4">
                        <StatusBadge state={job.state} />
                      </td>
                      <td className="p-4 text-sm text-muted-foreground">
                        {new Date(job.createdAt).toLocaleString()}
                      </td>
                      <td className="p-4 text-sm font-mono">{job.mondayItemId}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
