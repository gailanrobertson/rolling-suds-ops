import { NextRequest, NextResponse } from 'next/server';
import { createJob, updateJob, createInvoice, isWorkizConfigured } from '@/lib/workiz';

export async function POST(req: NextRequest) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const body: any = await req.json();
    if (!isWorkizConfigured()) return NextResponse.json({ success: true, mode: 'mock', data: { UUID: 'mock-' + Date.now() } });

    if (body._action === 'addItem' && body.UUID) {
      const { UUID, ...rest } = body; delete rest._action;
      return NextResponse.json({ success: true, data: await updateJob(UUID, rest) });
    }
    if (body._action === 'createInvoice' && body.ClientId) {
      const today = new Date().toISOString().split('T')[0];
      return NextResponse.json({ success: true, data: await createInvoice({ ClientId: body.ClientId, Created: today }) });
    }
    if (body._action === 'updateStatus' && body.UUID) {
      return NextResponse.json({ success: true, data: await updateJob(body.UUID, { Status: body.Status }) });
    }

    // Create job + full post-creation flow
    const price = Number(body.jobPrice) || 290;
    const { jobPrice: _p, _action: _a, ...createData } = body; void _p; void _a;
    const jobResult = await createJob(createData);
    const info = Array.isArray(jobResult?.data) ? jobResult.data[0] : (jobResult?.data || {});
    const uuid = info.UUID as string;
    const clientId = info.ClientId as string;
    const today = new Date().toISOString().split('T')[0];
    if (uuid) { try { await updateJob(uuid, { ItemName: 'Starbucks Cleaning', ItemQuantity: 1, ItemPrice: price }); } catch { /* ok */ } }
    if (clientId) { try { await createInvoice({ ClientId: clientId, Created: today }); } catch { /* ok */ } }
    if (uuid) { try { await updateJob(uuid, { Status: 'done' }); } catch { /* ok */ } }
    return NextResponse.json({ success: true, mode: 'live', data: info });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}