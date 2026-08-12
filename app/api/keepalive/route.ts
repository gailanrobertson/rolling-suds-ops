import { NextResponse } from 'next/server';
import { touchKeepalive } from '@/lib/db';

export async function GET() {
  try {
    const timestamp = await touchKeepalive();
    return NextResponse.json({ success: true, timestamp });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
