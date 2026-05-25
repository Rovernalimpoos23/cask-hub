import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    console.log('Fireflies webhook received:', JSON.stringify(body, null, 2))

    // Return success immediately so Fireflies doesn't retry
    // Process data after confirming payload structure
    return NextResponse.json({ success: true, received: true })
  } catch (error) {
    console.error('Fireflies webhook error:', error)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
