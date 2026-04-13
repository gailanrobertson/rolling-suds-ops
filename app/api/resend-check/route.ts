import { NextResponse } from 'next/server';

export async function GET() {
  const apiToken = process.env.WORKIZ_API_TOKEN || '';
  const secret = process.env.WORKIZ_API_SECRET || '';
  const base = 'https://api.workiz.com/api/v1/' + apiToken;
  const today = new Date().toISOString().split('T')[0];

  // Step 1: Create a test job and see what the response contains
  const jobRes = await fetch(base + '/job/create/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      auth_secret: secret,
      FirstName: 'Store # TEST',
      LastName: 'Workorder # TEST',
      Company: 'Superclean',
      Email: 'documents@gosuperclean.com',
      Address: '2517 W. North Ave.',
      City: 'Melrose Park',
      State: 'IL',
      Country: 'US',
      PostalCode: '60160',
      JobType: 'Starbucks Cleaning',
      JobSource: 'National Accounts',
      type_of_job: 'National Accounts',
      ServiceArea: 'MELROSE PARK - 60160',
      JobDateTime: today + ' 22:00',
      JobNotes: 'API TEST - DELETE ME',
    })
  });
  const jobData = await jobRes.json();
  const uuid = jobData?.data?.UUID;
  const clientId = jobData?.data?.ClientId;

  // Step 2: If we got a ClientId back, try invoice/create right away
  let invResult = null;
  if (clientId) {
    const invRes = await fetch(base + '/invoice/create/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ auth_secret: secret, ClientId: clientId, Created: today })
    });
    invResult = { status: invRes.status, data: await invRes.json().catch(() => ({})) };
  }

  return NextResponse.json({ jobStatus: jobRes.status, jobData, uuid, clientId, invResult });
}
