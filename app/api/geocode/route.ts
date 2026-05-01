import { NextRequest, NextResponse } from 'next/server';

const STATE_ABBREV: Record<string, string> = {
  'Alabama':'AL','Alaska':'AK','Arizona':'AZ','Arkansas':'AR','California':'CA',
  'Colorado':'CO','Connecticut':'CT','Delaware':'DE','Florida':'FL','Georgia':'GA',
  'Hawaii':'HI','Idaho':'ID','Illinois':'IL','Indiana':'IN','Iowa':'IA',
  'Kansas':'KS','Kentucky':'KY','Louisiana':'LA','Maine':'ME','Maryland':'MD',
  'Massachusetts':'MA','Michigan':'MI','Minnesota':'MN','Mississippi':'MS','Missouri':'MO',
  'Montana':'MT','Nebraska':'NE','Nevada':'NV','New Hampshire':'NH','New Jersey':'NJ',
  'New Mexico':'NM','New York':'NY','North Carolina':'NC','North Dakota':'ND','Ohio':'OH',
  'Oklahoma':'OK','Oregon':'OR','Pennsylvania':'PA','Rhode Island':'RI','South Carolina':'SC',
  'South Dakota':'SD','Tennessee':'TN','Texas':'TX','Utah':'UT','Vermont':'VT',
  'Virginia':'VA','Washington':'WA','West Virginia':'WV','Wisconsin':'WI','Wyoming':'WY'
};

function toStateAbbrev(state: string): string {
  if (!state) return '';
  if (state.length === 2) return state.toUpperCase();
  return STATE_ABBREV[state] || state;
}

// Generate alternate street name forms for highway-style addresses
// e.g. "1681 South IL Route 59" → ["1681 IL Route 59", "1681 Route 59", "1681 IL-59", "1681 IL 59"]
function streetVariants(street: string): string[] {
  const variants = new Set<string>();
  variants.add(street);

  let s = street;

  // Strip leading directional (North/South/East/West)
  s = s.replace(/^\d+\s+(North|South|East|West)\s+/i, (m) => m.replace(/North|South|East|West/i, '').replace(/\s+/, ' '));
  variants.add(s);

  // Normalize state highway: "IL Route 59" → "Route 59", "IL-59", "IL 59"
  const highwayMatch = s.match(/^(\d+\s+)(?:[A-Z]{2}\s+)?(?:Route|Hwy|Highway|St Hwy|State Route|SR)\s*(\d+)/i);
  if (highwayMatch) {
    const num = highwayMatch[1]; // e.g. "1681 "
    const rt = highwayMatch[2];  // e.g. "59"
    variants.add(`${num}Route ${rt}`);
    variants.add(`${num}Highway ${rt}`);
    variants.add(`${num}IL-${rt}`);
    variants.add(`${num}IL ${rt}`);
  }

  return Array.from(variants);
}

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function nominatimSearch(params: URLSearchParams): Promise<Array<Record<string, unknown>>> {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?${params}`,
    { headers: { 'User-Agent': 'RollingSudsOps/1.0' } }
  );
  return res.json();
}

function extractFromNominatim(data: Array<Record<string, unknown>>): { state: string; postcode: string; displayName: string } | null {
  if (!data || data.length === 0) return null;
  const best = data[0];
  const addr = (best.address as Record<string, string>) || {};
  const state = toStateAbbrev(addr.state || '');
  const postcode = (addr.postcode || '').split('-')[0];
  if (!state && !postcode) return null;
  return { state, postcode, displayName: best.display_name as string };
}

async function tryGoogleMaps(address: string, city: string, state: string): Promise<{ state: string; postcode: string; displayName: string } | null> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey) return null;
  const query = [address, city, state, 'USA'].filter(Boolean).join(', ');
  const params = new URLSearchParams({ address: query, key: apiKey });
  const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?${params}`);
  const data = await res.json();
  if (data.status !== 'OK' || !data.results?.length) return null;
  const components: Array<{ types: string[]; short_name: string; long_name: string }> = data.results[0].address_components;
  const stateComp = components.find(c => c.types.includes('administrative_area_level_1'));
  const zipComp = components.find(c => c.types.includes('postal_code'));
  const foundState = stateComp?.short_name || '';
  const foundZip = zipComp?.short_name || '';
  if (!foundState && !foundZip) return null;
  return { state: foundState, postcode: foundZip, displayName: data.results[0].formatted_address };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const address = searchParams.get('address') || '';
  const city = searchParams.get('city') || '';
  const state = searchParams.get('state') || '';
  if (!city) return NextResponse.json({ error: 'city required' }, { status: 400 });

  try {
    // 1. Try structured Nominatim search with each street name variant
    for (const variant of streetVariants(address)) {
      const params = new URLSearchParams({
        street: variant,
        city,
        country: 'US',
        format: 'json',
        addressdetails: '1',
        limit: '3',
      });
      if (state) params.set('state', state);
      const data = await nominatimSearch(params);
      const result = extractFromNominatim(data);
      if (result) return NextResponse.json({ found: true, ...result });
      await delay(1100); // Nominatim rate limit: 1 req/sec
    }

    // 2. Free-text Nominatim fallback with original address
    const freeParams = new URLSearchParams({
      q: [address, city, state, 'US'].filter(Boolean).join(', '),
      format: 'json',
      addressdetails: '1',
      limit: '3',
      countrycodes: 'us',
    });
    const freeData = await nominatimSearch(freeParams);
    const fromFree = extractFromNominatim(freeData);
    if (fromFree) return NextResponse.json({ found: true, ...fromFree });

    // 3. Google Maps fallback
    await delay(300);
    const fromGoogle = await tryGoogleMaps(address, city, state);
    if (fromGoogle) return NextResponse.json({ found: true, ...fromGoogle });

    return NextResponse.json({ found: false });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
