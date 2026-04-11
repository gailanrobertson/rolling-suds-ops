import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const address = searchParams.get('address');
  const city = searchParams.get('city');

  if (!address || !city) {
    return NextResponse.json({ error: 'address and city required' }, { status: 400 });
  }

  try {
    const query = encodeURIComponent(`${address}, ${city}`);
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${query}&format=json&addressdetails=1&limit=1`,
      { headers: { 'User-Agent': 'RollingSudsOps/1.0' } }
    );
    const data = await res.json();

    if (!data || data.length === 0) {
      return NextResponse.json({ found: false });
    }

    const place = data[0];
    const addr = place.address || {};

    return NextResponse.json({
      found: true,
      state: addr.state || '',
      postcode: addr.postcode || '',
      city: addr.city || addr.town || addr.village || city,
      country: addr.country_code?.toUpperCase() || 'US',
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
