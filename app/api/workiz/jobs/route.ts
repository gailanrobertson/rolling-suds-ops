import { NextRequest, NextResponse } from 'next/server';
import { createJob, updateJob, isWorkizConfigured } from '@/lib/workiz';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (!isWorkizConfigured()) {
      return NextResponse.json({
        success: true,
        mode: 'mock',
        message: 'Workiz not configured — mock response.',
        data: { UUID: `mock-${Date.now()}` },
      });
    }

    // Handle adding a line item to an existing job
    if (body._action === 'addItem' && body.UUID) {
      const { _action, UUID, ...itemData } = body;
      const result = await updateJob(UUID, itemData);
      return NextResponse.json({ success: true, mode: 'live', data: result });
    }

    // Default: create a new job
    const { _action, ...createData } = body;
    const result = await createJob(createData);
    return NextResponse.json({ success: true, mode: 'live', data: result });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
