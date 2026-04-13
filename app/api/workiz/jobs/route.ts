import { NextRequest, NextResponse } from 'next/server';
import { createJob, updateJob, createInvoice, isWorkizConfigured } from '@/lib/workiz';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (!isWorkizConfigured()) {
      return NextResponse.json({
        success: true, mode: 'mock',
        message: 'Workiz not configured.',
        data: { UUID: `mock-${Date.now()}` },
      });
    }

    // addItem
    if (body._action === 'addItem' && body.UUID) {
      const { _action, UUID, ...itemData } = body;
      const result = await updateJob(UUID, itemData);
      return NextResponse.json({ success: true, mode: 'live', data: result });
    }

    // createInvoice
    if (body._action === 'createInvoice' && body.ClientId) {
      const today = new Date().toISOString().split('T')[0];
      const result = await createInvoice({ ClientId: body.ClientId, Created: body.Created || today });
      return NextResponse.json({ success: true, mode: 'live', data: result });
    }

    // updateStatus
    if (body._action === 'updateStatus' && body.UUID) {
      const result = await updateJob(body.UUID, { Status: body.Status });
      return NextResponse.json({ success: true, mode: 'live', data: result });
    }

    // Default: create job then auto-run full flow
    const { _action, jobPrice, ...createData } = body;
    const jobResult = await createJob(createData);

    // Extract UUID and ClientId from response (data is array)
    const jobInfo = Array.isArray(jobResult?.data) ? jobResult.data[0] : jobResult?.data;
    const uuid = jobInfo?.UUID;
    const clientId = jobInfo?.ClientId;

    const today = new Date().toISOString().split('T')[0];
    const followUp: Record<string, unknown> = {};

    // 1. Add line item
    if (uuid) {
      try {
        const itemRes = await updateJob(uuid, {
          ItemName: 'Starbucks Cleaning',
          ItemQuantity: 1,
          ItemPrice: jobPrice || 290,
        });
        followUp.itemResult = itemRes;
      } catch (e) { followUp.itemError = String(e); }
    }

    // 2. Create invoice
    if (clientId) {
      try {
        const invRes = await createInvoice({ ClientId: clientId, Created: today });
        followUp.invoiceResult = invRes;
      } catch (e) { followUp.invoiceError = String(e); }
    }

    // 3. Set status to done
    if (uuid) {
      try {
        const statusRes = await updateJob(uuid, { Status: 'done' });
        followUp.statusResult = statusRes;
      } catch (e) { followUp.statusError = String(e); }
    }

    return NextResponse.json({ success: true, mode: 'live', data: jobInfo, followUp });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
