# Heimdall - Monday to Figma Briefing Sync

Automated Monday.com briefing to Figma template sync with admin dashboard.

## Quick Start

### Development

```bash
npm install
npm run dev        # Start Next.js admin panel (port 3846)
npm run dev:backend  # Start legacy backend server (if needed)
```

### Production Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for complete Vercel deployment guide.

## Architecture

- **Backend**: Next.js API routes (replaces raw HTTP server)
- **Frontend**: Next.js App Router with shadcn/ui + Loop-Vesper design system
- **Storage**: Vercel KV (Redis) for job queue, settings, webhook logs
- **Auth**: HTTP Basic Auth (configurable via `ADMIN_PASSWORD`)
- **Plugin**: Figma plugin for syncing queued briefings to canvas

## Project Structure

```
app/                    # Next.js pages and API routes
  api/                  # API route handlers
  jobs/                 # Job browser page
  queue/                # Manual queue page
  routing/              # Routing map editor
  settings/             # Settings page
  page.tsx              # Dashboard
  layout.tsx            # Root layout with nav
lib/
  kv.ts                 # Vercel KV persistence layer
components/
  ui/                   # shadcn/ui components
  nav.tsx               # Sidebar navigation
src/                    # Backend domain logic (unchanged)
  agents/               # Claude mapping agent
  domain/               # Briefing, routing logic
  integrations/         # Monday, Figma clients
  orchestration/        # createOrQueueFigmaPage
figma-plugin/           # Figma plugin code
```

## Key Features

- ✅ **Automatic Queueing**: Monday webhooks trigger job creation
- ✅ **Manual Queue**: Admin panel for manual briefing queueing
- ✅ **Figma Plugin**: Sync queued jobs to monthly files
- ✅ **Idempotency**: Prevent duplicate page creation
- ✅ **Routing Map**: Dynamic batch → file key mapping (stored in KV)
- ✅ **Eligibility Filters**: Control which Monday items are synced
- ✅ **Claude Mapping**: AI-powered field extraction from Monday Docs
- ✅ **Admin Dashboard**: Queue stats, recent jobs, system health
- ✅ **Persistent Storage**: Vercel KV (Redis) for job queue

## Scripts

- `npm run dev` - Start Next.js dev server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run queue` - Test manual queueing
- `npm run lint` - Run ESLint

## Environment Variables

See [.env.example](./.env.example) for required configuration.

## Documentation

- [DEPLOYMENT.md](./DEPLOYMENT.md) - Vercel deployment guide
- [.cursor/plans/](./. cursor/plans/) - Implementation plans

## Support

For issues or questions, check Vercel logs and the deployment guide.
