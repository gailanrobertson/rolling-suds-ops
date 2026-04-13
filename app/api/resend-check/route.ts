import { NextResponse } from 'next/server';

export async function GET() {
  const apiToken = process.env.WORKIZ_API_TOKEN || '';
  const secret = process.env.WORKIZ_API_SECRET || '';
  const base = 'https://api.workiz.com/api/v1/' + apiToken;
  const clientId = '1383';
  const today = new Date().toISOString().split('T')[0];

  // Try 1: ClientId + Created + no items (to see what other fields are required)
  const t1 = await fetch(base + '/invoice/create/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ auth_secret: secret, ClientId: clientId, Created: today })
  });
  const d1 = await t1.json().catch(() => ({}));

  // Try 2: ClientId + Created + Items (capital I, different format)
  const t2 = await fetch(base + '/invoice/create/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      auth_secret: secret,
      ClientId: clientId,
      Created: today,
      Items: [{ Name: 'Starbucks Cleaning', Quantity: 1, Price: 290, Cost: 0 }]
    })
  });
  const d2 = await t2.json().catch(() => ({}));

  return NextResponse.json({ t1: { status: t1.status, data: d1 }, t2: { status: t2.status, data: d2 } });
}
