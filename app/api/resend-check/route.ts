import { NextResponse } from 'next/server';

export async function GET() {
  const apiToken = process.env.WORKIZ_API_TOKEN || '';
  const secret = process.env.WORKIZ_API_SECRET || '';
  const base = 'https://api.workiz.com/api/v1/' + apiToken;
  const uuid = 'LHHROT';

  // Get job to find ClientId
  const jobRes = await fetch(base + '/job/get/' + uuid + '/');
  const jobData = await jobRes.json();
  const job = jobData?.data?.[0] || {};
  const clientId = job.ClientId || '';

  const results: Record<string, unknown> = { clientId, jobStatus: jobRes.status };

  // Test 1: invoice/create with ClientId + LineItems
  const inv1 = await fetch(base + '/invoice/create/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      auth_secret: secret,
      JobUUID: uuid,
      ClientId: clientId,
      LineItems: [{ name: 'Starbucks Cleaning', quantity: 1, price: 290, cost: 0, taxable: false }]
    })
  });
  results.inv1 = { status: inv1.status, data: await inv1.json().catch(() => 'parse error') };

  // Test 2: invoice/create with different field names
  const inv2 = await fetch(base + '/invoice/create/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      auth_secret: secret,
      job_uuid: uuid,
      client_id: clientId,
      line_items: [{ name: 'Starbucks Cleaning', quantity: 1, price: 290 }]
    })
  });
  results.inv2 = { status: inv2.status, data: await inv2.json().catch(() => 'parse error') };

  return NextResponse.json(results);
}
