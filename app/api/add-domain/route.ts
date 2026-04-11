import { NextResponse } from 'next/server';
export async function GET() {
  const res = await fetch('https://api.resend.com/domains', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name: 'rollingsudsofschaumburgrosemont.com', region: 'us-east-1' }),
  });
  const data = await res.json();
  return NextResponse.json({ status: res.status, data });
}