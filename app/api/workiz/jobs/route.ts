import { NextRequest, NextResponse } from 'next/server';
import { createJob, updateJob, isWorkizConfigured } from '@/lib/workiz';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (!isWorkizConfigured()) {
      return NextResponse.json({ success: true, mode: 'mock', message: 'Workiz not configured.', data: { UUID: 'mock-' + Date.now() } });
    }

    if (body._action === 'updateStatus' && body.UUID) {
      const result = await updateJob(body.UUID as string, { Status: body.Status });
      return NextResponse.json({ success: true, mode: 'live', data: result });
    }

    // Create job
    const { _action: _a, jobPrice: _p, ...createData } = body;
    void _a; void _p;
    const jobResult = await createJob(createData);
    const arr = Array.isArray(jobResult?.data) ? jobResult.data : [jobResult?.data];
    const info = (arr[0] || jobResult?.data || {}) as Record<string, unknown>;
    const uuid = info.UUID as string;

    // Set status to done after creation
    if (uuid) {
      try { await updateJob(uuid, { Status: 'done' }); } catch { /* non-blocking */ }
    }

    return NextResponse.json({ success: true, mode: 'live', data: info });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}