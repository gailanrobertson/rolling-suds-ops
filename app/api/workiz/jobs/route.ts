import { NextRequest, NextResponse } from 'next/server';
import { createJob, updateJob, createInvoice, isWorkizConfigured } from '@/lib/workiz';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (!isWorkizConfigured()) {
      return NextResponse.json({
        success: true, mode: 'mock',
        message: 'Workiz not configured.',
        data: { UUID: 'mock-' + Date.now() },
      });
    }

    if (body._action === 'addItem' && body.UUID) {
      const { UUID, ...itemData } = body;
      delete itemData._action;
      const result = await updateJob(UUID as string, itemData);
      return NextResponse.json({ success: true, mode: 'live', data: result });
    }

    if (body._action === 'createInvoice' && body.ClientId) {
      const today = new Date().toISOString().split('T')[0];
      const result = await createInvoice({ ClientId: body.ClientId, Created: body.Created || today });
      return NextResponse.json({ success: true, mode: 'live', data: result });
    }

    if (body._action === 'updateStatus' && body.UUID) {
      const result = await updateJob(body.UUID as string, { Status: body.Status });
      return NextResponse.json({ success: true, mode: 'live', data: result });
    }

    // Default: create job then run full post-creation flow
    const { jobPrice, ...createData } = body;
    delete createData._action;
    const jobResult = await createJob(createData);

    const jobArr = Array.isArray(jobResult?.data) ? jobResult.data : [jobResult?.data];
    const jobInfo = jobArr[0] || {};
    const uuid = jobInfo.UUID as string | undefined;
    const clientId = jobInfo.ClientId as string | undefined;
    const today = new Date().toISOString().split('T')[0];
    const price = (jobPrice as number) || 290;

    // Add line item (best-effort)
    if (uuid) {
      try { await updateJob(uuid, { ItemName: 'Starbucks Cleaning', ItemQuantity: 1, ItemPrice: price }); } catch { /* ignore */ }
    }

    // Create invoice (best-effort)
    if (clientId) {
      try { await createInvoice({ ClientId: clientId, Created: today }); } catch { /* ignore */ }
    }

    // Set status done (best-effort)
    if (uuid) {
      try { await updateJob(uuid, { Status: 'done' }); } catch { /* ignore */ }
    }

    return NextResponse.json({ success: true, mode: 'live', data: jobInfo });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
