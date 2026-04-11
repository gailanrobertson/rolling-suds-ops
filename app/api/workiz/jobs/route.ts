import { NextRequest, NextResponse } from 'next/server';
import { createJob, isWorkizConfigured } from '@/lib/workiz';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (!isWorkizConfigured()) {
      return NextResponse.json({
        success: true,
        mode: 'mock',
        message: 'Workiz is not configured. Returning a mock response.',
        data: { UUID: `mock-${Date.now()}`, ...body },
      });
    }

    const result = await createJob(body);
    return NextResponse.json({ success: true, mode: 'live', data: result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
