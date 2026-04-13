import { NextResponse } from 'next/server';

export async function GET() {
  const apiToken = process.env.WORKIZ_API_TOKEN || '';
  const secret = process.env.WORKIZ_API_SECRET || '';
  const base = 'https://api.workiz.com/api/v1/' + apiToken;
  const uuid = 'LHHROT';

  const jobRes = await fetch(base + '/job/get/' + uuid + '/');
  const jobData = await jobRes.json();
  const clientId = (jobData?.data?.[0]?.ClientId) || '';

  const invRes = await fetch(base + '/invoice/create/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      auth_secret: secret,
      JobUUID: uuid,
      ClientId: clientId,
      LineItems: [{ name: 'Starbucks Cleaning', quantity: 1, price: 290, cost: 0, taxable: false }]
    })
  });
  const invData = await invRes.json();

  return NextResponse.json({ clientId, invStatus: invRes.status, invData });
}
