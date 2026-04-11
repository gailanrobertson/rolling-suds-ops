import { NextResponse } from 'next/server';
export async function GET() {
  const res = await fetch('https://api.resend.com/domains/94e74ca6-1255-4a2b-8735-6f6f5c24ca19', {
    headers: {
      'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
    },
  });
  const data = await res.json();
  return NextResponse.json(data);
}