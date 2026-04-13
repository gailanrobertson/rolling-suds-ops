import { NextResponse } from 'next/server';

export async function GET() {
  const apiToken = process.env.WORKIZ_API_TOKEN || '';
  const secret = process.env.WORKIZ_API_SECRET || '';
  const base = `https://api.workiz.com/api/v1/${apiToken}`;
  const uuid = 'LHHROT';
  const body = { auth_secret: secret, UUID: uuid };
  
  const endpoints = [
    'job/item/',
    'items/',
    'job/lineitem/',
  ];
  
  const results: Record<string, unknown> = {};
  for (const ep of endpoints) {
    try {
      const r = await fetch(`${base}/${ep}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...body, name: 'Starbucks Cleaning', price: 290, quantity: 1 })
      });
      const d = await r.json().catch(() => ({}));
      results[ep] = { status: r.status, data: d };
    } catch (e) {
      results[ep] = { error: String(e) };
    }
  }
  return NextResponse.json(results);
}
