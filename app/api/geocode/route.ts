import { NextRequest, NextResponse } from 'next/server';

const STATE_ABBREV: Record<string, string> = {"Alabama":"AL","Alaska":"AK","Arizona":"AZ","Arkansas":"AR","California":"CA","Colorado":"CO","Connecticut":"CT","Delaware":"DE","Florida":"FL","Georgia":"GA","Hawaii":"HI","Idaho":"ID","Illinois":"IL","Indiana":"IN","Iowa":"IA","Kansas":"KS","Kentucky":"KY","Louisiana":"LA","Maine":"ME","Maryland":"MD","Massachusetts":"MA","Michigan":"MI","Minnesota":"MN","Mississippi":"MS","Missouri":"MO","Montana":"MT","Nebraska":"NE","Nevada":"NV","New Hampshire":"NH","New Jersey":"NJ","New Mexico":"NM","New York":"NY","North Carolina":"NC","North Dakota":"ND","Ohio":"OH","Oklahoma":"OK","Oregon":"OR","Pennsylvania":"PA","Rhode Island":"RI","South Carolina":"SC","South Dakota":"SD","Tennessee":"TN","Texas":"TX","Utah":"UT","Vermont":"VT","Virginia":"VA","Washington":"WA","West Virginia":"WV","Wisconsin":"WI","Wyoming":"WY"};

function toStateAbbrev(state: string): string {
  if (!state) return '';
  if (state.length === 2) return state.toUpperCase();
  return STATE_ABBREV[state] || state;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const address = searchParams.get('address');
  const city = searchParams.get('city');
  const state = searchParams.get('state') || '';

  if (!address || !city) {
    return NextResponse.json({ error: 'address and city required' }, { status: 400 });
  }

  try {
    // Build query — include state if we have it for accuracy
    const queryParts = [address, city];
    if (state) queryParts.push(state);
    queryParts.push('USA');

    const query = encodeURIComponent(queryParts.join(', '));
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${query}&format=json&addressdetails=1&limit=3&countrycodes=us`,
      { headers: { 'User-Agent': 'RollingSudsOps/1.0' } }
    );
    const data = await res.json();

    if (!data || data.length === 0) {
      return NextResponse.json({ found: false });
    }

    // Pick the best result — prefer one that matches the city name
    const cityLower = city.toLowerCase();
    const best = data.find((r: Record<string, unknown>) => {
      const addr = r.address as Record<string, string> || {};
      const resultCity = (addr.city || addr.town || addr.suburb || addr.village || '').toLowerCase();
      return resultCity.includes(cityLower) || cityLower.includes(resultCity);
    }) || data[0];

    const addr = best.address as Record<string, string> || {};
    const stateAbbrev = toStateAbbrev(addr.state || '');

    return NextResponse.json({
      found: true,
      state: stateAbbrev,
      postcode: addr.postcode || '',
      city: addr.city || addr.town || addr.suburb || addr.village || city,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
