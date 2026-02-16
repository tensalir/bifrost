import { NextResponse } from 'next/server'
import { getRoutingMap, getWebhookLog } from '@/lib/kv'

export async function GET() {
  try {
    const kv = !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN)
    const monday = !!process.env.MONDAY_API_TOKEN
    const figma = !!process.env.FIGMA_ACCESS_TOKEN
    const [routingMap, webhookLog] = await Promise.all([getRoutingMap(), getWebhookLog(1)])
    const routingMapHasEntries = Object.keys(routingMap).length > 0
    const webhookReceived = webhookLog.length > 0

    const allPass =
      kv && monday && figma && routingMapHasEntries && webhookReceived

    return NextResponse.json(
      {
        ready: allPass,
        checks: {
          kv,
          monday,
          figma,
          routingMap: routingMapHasEntries,
          webhookReceived,
        },
      },
      { status: 200 }
    )
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export const dynamic = 'force-dynamic'
