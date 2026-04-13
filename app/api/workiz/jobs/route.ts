import { NextRequest, NextResponse } from 'next/server';
import { createJob, updateJob, createInvoice, isWorkizConfigured } from '@/lib/workiz';

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

    // Handle invoice creation
    if (body._action === 'createInvoice' && body.ClientId) {
      const today = new Date().toISOString().split('T')[0];
      const result = await createInvoice({ ClientId: body.ClientId, Created: body.Created || today });
      return NextResponse.json({ success: true, mode: 'live', data: result });
    }

    // Handle status update
    if (body._action === 'updateStatus' && body.UUID) {
      const result = await updateJob(body.UUID, { Status: body.Status });
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
