import { NextResponse } from 'next/server';

export async function GET() {
  const apiToken = process.env.WORKIZ_API_TOKEN || '';
  const secret = process.env.WORKIZ_API_SECRET || '';
  const base = 'https://api.workiz.com/api/v1/' + apiToken;

  // Use ITSANZ (Bruce Rockwell job) as test - ClientId 1383
  const uuid = 'ITSANZ';
  const clientId = '1383';

  // Test 1: invoice/create with all known required fields
  const t1 = await fetch(base + '/invoice/create/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      auth_secret: secret,
      JobUUID: uuid,
      ClientId: clientId,
      LineItems: [{ name: 'Test Item', quantity: 1, price: 100, cost: 0, taxable: false }]
    })
  });
  const d1 = await t1.json().catch(() => ({}));

  // Test 2: job/update with SubTotal to see if we can at least set total
  const t2 = await fetch(base + '/job/update/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      auth_secret: secret,
      UUID: uuid,
      JobTotalPrice: 290,
      SubTotal: 290
    })
  });
  const d2 = await t2.json().catch(() => ({}));

  return NextResponse.json({ t1: { status: t1.status, data: d1 }, t2: { status: t2.status, data: d2 } });
}
