// src/app/api/speak/route.ts
// Requires ELEVENLABS_API_KEY in environment (add to Vercel dashboard + .env.local)
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { text } = await req.json()

    const apiKey = process.env.ELEVENLABS_API_KEY
    const voiceId = process.env.ELEVENLABS_VOICE_ID || 'hIssydxXZ1WuDorjx6Ic'

    console.log('API Key exists:', !!apiKey)
    console.log('API Key first 8 chars:', apiKey?.substring(0, 8))
    console.log('Voice ID:', voiceId)
    console.log('Text to speak:', text?.substring(0, 50))

    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey!,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: text.substring(0, 300),
          model_id: 'eleven_turbo_v2_5',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
          },
        }),
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      console.error('ElevenLabs full error:', response.status, errorText)
      return NextResponse.json(
        { error: errorText },
        { status: response.status }
      )
    }

    const audioBuffer = await response.arrayBuffer()
    console.log('Audio buffer size:', audioBuffer.byteLength, 'bytes')

    return new NextResponse(audioBuffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': audioBuffer.byteLength.toString(),
      },
    })
  } catch (error) {
    console.error('ElevenLabs error:', error)
    return NextResponse.json(
      { error: 'Failed to generate speech' },
      { status: 500 }
    )
  }
}
