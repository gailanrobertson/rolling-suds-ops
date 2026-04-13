import { NextResponse } from 'next/server';

export async function GET() {
  const apiToken = process.env.WORKIZ_API_TOKEN || '';
  const secret = process.env.WORKIZ_API_SECRET || '';
  const base = 'https://api.workiz.com/api/v1/' + apiToken;
  const uuid = 'ITSANZ';
  const clientId = '1383';
  const today = new Date().toISOString().split('T')[0];

  // Test invoice/create with Created field and correct item format
  const t1 = await fetch(base + '/invoice/create/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      auth_secret: secret,
      ClientId: clientId,
      JobUUID: uuid,
      Created: today,
      items: [{ name: 'Test Item', quantity: 1, unit_price: 100 }]
    })
  });
  const d1 = await t1.json().catch(() => ({}));

  // Test invoice/create with job_uuid snake case
  const t2 = await fetch(base + '/invoice/create/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      auth_secret: secret,
      client_id: clientId,
      job_uuid: uuid,
      created: today,
    })
  });
  const d2 = await t2.json().catch(() => ({}));

  return NextResponse.json({ t1: { status: t1.status, data: d1 }, t2: { status: t2.status, data: d2 } });
}
