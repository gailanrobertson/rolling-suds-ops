const COMPANYCAM_TOKEN = process.env.COMPANYCAM_API_TOKEN || '';
const BASE_URL = 'https://api.companycam.com/v2';

async function ccFetch(endpoint: string) {
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    headers: {
      'Authorization': `Bearer ${COMPANYCAM_TOKEN}`,
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`CompanyCam API error ${res.status}: ${text}`);
  }
  return res.json();
}

export interface CCProject {
  id: string;
  name: string;
  photo_count?: number;
  address?: {
    street_address_1?: string;
    city?: string;
    state?: string;
  };
  created_at: number;
  updated_at: number;
}

export interface CCPhoto {
  id: string;
  uri: string;
  urls: {
    original: string;
    thumbnail: string;
  };
  uris?: Array<{ type: string; uri: string }>;
  captured_at: number;
  created_at: number;
  photo_url?: string;
}

export async function searchProjects(query: string): Promise<CCProject[]> {
  const encoded = encodeURIComponent(query);
  return ccFetch(`/projects?query=${encoded}&per_page=25`);
}

/**
 * Convert Illinois highway designators to the IL-XX format CompanyCam uses.
 * "4196-A Rt 83"   → "4196-A IL-83"
 * "1085 Route 12"  → "1085 IL-12"
 * "US Route 45"    → "US-45"
 */
function normalizeHighwayAddress(address: string): string {
  return address
    .replace(/\b(?:IL\s+)?(?:Rt|Rte|Route|Hwy|SR|State\s+Rt|State\s+Route)\s+(\d+)/gi, 'IL-$1')
    .replace(/\bUS\s+(?:Hwy\s+|Route\s+|Rt\s+|Rte\s+)?(\d+)/gi, 'US-$1');
}

/**
 * Returns true if a project is a real job (not a Workiz placeholder).
 * Workiz placeholders have names starting with "Workiz" and 0 photos.
 */
function isRealProject(p: CCProject): boolean {
  if (p.name && p.name.toLowerCase().startsWith('workiz')) return false;
  return true;
}

/**
 * Normalize an address for comparison: lowercase, expand/contract common
 * abbreviations so "33 South Evergreen Avenue" == "33 S Evergreen Ave".
 */
function normalizeAddress(s: string): string {
  if (!s) return '';
  let out = s.toLowerCase();
  // Multi-word directionals first so they don't get eaten by the single-word ones.
  const replacements: Array<[RegExp, string]> = [
    [/\bnortheast\b/g, 'ne'],
    [/\bnorthwest\b/g, 'nw'],
    [/\bsoutheast\b/g, 'se'],
    [/\bsouthwest\b/g, 'sw'],
    [/\bnorth\b/g, 'n'],
    [/\bsouth\b/g, 's'],
    [/\beast\b/g, 'e'],
    [/\bwest\b/g, 'w'],
    [/\bstreet\b/g, 'st'],
    [/\bavenue\b/g, 'ave'],
    [/\broad\b/g, 'rd'],
    [/\bdrive\b/g, 'dr'],
    [/\bboulevard\b/g, 'blvd'],
    [/\blane\b/g, 'ln'],
    [/\bplace\b/g, 'pl'],
    [/\bcourt\b/g, 'ct'],
    [/\bhighway\b/g, 'hwy'],
    [/\bparkway\b/g, 'pkwy'],
    [/\bcircle\b/g, 'cir'],
    [/\bterrace\b/g, 'ter'],
    [/\btrail\b/g, 'trl'],
  ];
  for (const [re, rep] of replacements) out = out.replace(re, rep);
  out = out.replace(/[.,#]/g, '').replace(/\s+/g, ' ').trim();
  return out;
}

/**
 * Pull the main street-name word out of an address, stripping the house
 * number, directionals, and common street-type suffixes.
 * "2000 Mannheim Rd" -> "mannheim"
 * "33 South Evergreen Avenue" -> "evergreen"
 * "1427 Lee St" -> "lee"
 */
function extractStreetName(address: string): string | null {
  const normalized = normalizeAddress(address);
  if (!normalized) return null;
  const parts = normalized.split(' ');
  const directionals = new Set(['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw']);
  const suffixes = new Set([
    'st', 'ave', 'rd', 'dr', 'blvd', 'ln', 'pl', 'ct',
    'hwy', 'pkwy', 'cir', 'ter', 'trl', 'way'
  ]);
  const nameWords = parts.filter((w, i) => {
    if (!w) return false;
    if (i === 0 && /^[0-9]+$/.test(w)) return false;
    if (directionals.has(w)) return false;
    if (suffixes.has(w)) return false;
    return true;
  });
  if (nameWords.length === 0) return null;
  return nameWords.join(' ');
}

/** Convert a CompanyCam timestamp (may be seconds or ms) to milliseconds. */
function toMillis(ts: number): number {
  return ts < 10_000_000_000 ? ts * 1000 : ts;
}

export async function findStarbucksProject(
  storeNumber: string,
  woNumber?: string,
  address?: string
): Promise<CCProject | null> {

  // 1. Exact match: "Starbucks #00806 WO# 1963606"
  if (woNumber) {
    const results = await searchProjects(`Starbucks #${storeNumber} WO# ${woNumber}`);
    const match = results.find(
      (p) => p.name && p.name.includes(`#${storeNumber}`) && p.name.includes(woNumber) && isRealProject(p)
    );
    if (match) return match;
  }

  // 2. Store number in name: "Starbucks #00806"
  const storeResults = await searchProjects(`Starbucks #${storeNumber}`);
  const storeMatches = storeResults.filter(
    (p) => p.name && p.name.includes(`#${storeNumber}`) && isRealProject(p)
  );
  if (storeMatches.length > 0) {
    if (woNumber) {
      const woMatch = storeMatches.find((p) => p.name.includes(woNumber));
      if (woMatch) return woMatch;
    }
    storeMatches.sort((a, b) => b.updated_at - a.updated_at);
    return storeMatches[0];
  }

  // 2b. Workiz-format store number: "Store # 13440" (accept Workiz-named projects if they have photos)
  const workizResults = await searchProjects(`Store # ${storeNumber}`);
  const workizMatches = workizResults.filter(
    (p) => p.name && p.name.includes(storeNumber) && (p.photo_count ?? 0) > 0
  );
  if (workizMatches.length > 0) {
    workizMatches.sort((a, b) => b.updated_at - a.updated_at);
    return workizMatches[0];
  }

  if (address) {
    const normalizedTarget = normalizeAddress(address);

    // Extract street number and primary street-name keywords used for address verification.
    // "200 E Randolph St, Chicago, IL" → rawStreetNum="200", streetKeyword="randolph"
    // "9900 Route 47, Huntley, IL"     → rawStreetNum="9900", streetKeyword="il-47"
    // "6000 Northwest Hwy, Crystal Lake, IL" → rawStreetNum="6000", streetKeyword="crystal" (broken by
    //   normalizeAddress turning "northwest"→"nw"→directional stripped), rawKeyword="northwest" (fix)
    const rawStreetNum = address.trim().match(/^(\d+)/)?.[1] ?? null;
    // Keyword from highway-normalized form handles "Route 47" → "IL-47".
    const streetKeyword = extractStreetName(normalizeHighwayAddress(address))?.split(' ')[0] ?? null;
    // Raw keyword: same logic but does NOT abbreviate multi-word directionals, so "Northwest" is
    // preserved as a keyword instead of being collapsed to "nw" and then stripped as a directional.
    // If every remaining word is a suffix (e.g. "Lane Rd" where "Lane" is the street name),
    // fall back to the first candidate rather than returning null.
    const rawKeyword = (() => {
      const streetPart = address.split(',')[0].trim().toLowerCase();
      const parts = streetPart.split(/\s+/);
      const abbrevDirs = new Set(['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw']);
      const suffs = new Set([
        'st', 'ave', 'rd', 'dr', 'blvd', 'ln', 'pl', 'ct', 'hwy', 'pkwy',
        'cir', 'ter', 'trl', 'way', 'street', 'avenue', 'road', 'drive',
        'boulevard', 'highway', 'lane', 'place', 'court', 'parkway', 'circle',
        'terrace', 'trail',
      ]);
      const candidates: string[] = [];
      for (let i = 0; i < parts.length; i++) {
        const w = parts[i];
        if (!w) continue;
        if (i === 0 && /^\d/.test(w)) continue;
        if (abbrevDirs.has(w)) continue;
        candidates.push(w);
      }
      // Prefer first non-suffix word; fall back to first candidate if all are suffixes
      // (handles "Lane Rd" where "Lane" is the street name, not a type).
      return candidates.find(w => !suffs.has(w)) ?? candidates[0] ?? null;
    })();

    /**
     * Pick the best verified result from a candidate list.
     *
     * Priority 1 — Name-verified: project name contains "starbucks" or the store number.
     *   Catches the standard naming convention "Starbucks #02264 WO# 1979789".
     *
     * Priority 2 — Address-verified: the CC project's own address field contains both
     *   our street number AND at least one street-name keyword.
     *   Checks streetKeyword (highway-normalized: "il-47") and rawKeyword ("northwest")
     *   so roads named "Northwest Hwy" and state routes like "IL-47" both match.
     *   CC address is also highway-normalized so "Illinois Rte 31" → "Illinois IL-31".
     *
     * Returns null if no result passes either check — never returns unverified results.
     */
    function bestVerified(candidates: CCProject[]): CCProject | null {
      const real = candidates.filter(isRealProject);
      // Priority 1: name-verified
      const byName = real.find(
        (p) => p.name && (p.name.toLowerCase().includes('starbucks') || p.name.includes(storeNumber))
      );
      if (byName) return byName;
      // Priority 2: address-verified
      if (rawStreetNum && (streetKeyword || rawKeyword)) {
        const byAddr = real.find((p) => {
          const ccAddr = normalizeHighwayAddress(p.address?.street_address_1 || '').toLowerCase();
          if (!ccAddr) return false;
          if (!ccAddr.includes(rawStreetNum)) return false;
          if (streetKeyword && ccAddr.includes(streetKeyword)) return true;
          if (rawKeyword && ccAddr.includes(rawKeyword)) return true;
          // "Route 14" normalizes to "il-14" but CompanyCam may store it as "us-14".
          // Accept either IL- or US- prefix for the same highway number.
          const hwNum = streetKeyword?.match(/^(?:il|us)-(\d+)$/)?.[1];
          if (hwNum) {
            const hwPattern = new RegExp(`(?:il|us)-${hwNum}(?!\\d)`);
            if (hwPattern.test(ccAddr)) return true;
          }
          return false;
        });
        if (byAddr) return byAddr;
      }
      return null;
    }

    // 3. Highway-style address: convert "Rt 83" → "IL-83" before searching.
    const highwayAddress = normalizeHighwayAddress(address);
    if (highwayAddress !== address) {
      const match = bestVerified(await searchProjects(highwayAddress));
      if (match) return match;
      // 3b. "Route 14" normalizes to "IL-14" but CompanyCam may store it as "US-14".
      // Try the US- prefix form so the search actually returns the project.
      const usHighwayAddress = highwayAddress.replace(/\bIL-(\d+)/g, 'US-$1');
      if (usHighwayAddress !== highwayAddress) {
        const match3b = bestVerified(await searchProjects(usHighwayAddress));
        if (match3b) return match3b;
      }
    }

    // 4. Full address search
    const match4 = bestVerified(await searchProjects(address));
    if (match4) return match4;

    // 4b. Street address only (strip city/state — trailing ", Chicago, IL 60601" can
    // confuse CompanyCam's search and prevent a match on the street portion alone).
    const streetOnly = address.split(',')[0].trim();
    if (streetOnly && streetOnly !== address.trim()) {
      const match4b = bestVerified(await searchProjects(streetOnly));
      if (match4b) return match4b;
    }

    // 4c. Normalized (abbreviated) address form
    if (normalizedTarget && normalizedTarget !== address.toLowerCase().trim()) {
      const match4c = bestVerified(await searchProjects(normalizedTarget));
      if (match4c) return match4c;
    }

    // 5. Street number only — handles state roads and short house numbers.
    // Lowered threshold to \d{2,} so 2-digit numbers like "39" are not skipped.
    const parts = normalizedTarget.split(' ');
    const streetNumMatch = parts[0]?.match(/^(\d{2,})/);
    const streetNum = streetNumMatch ? streetNumMatch[1] : null;
    if (streetNum) {
      const match5 = bestVerified(await searchProjects(streetNum));
      if (match5) return match5;
    }

    // 6. Street name search — verified by street number in CC address field.
    // Handles cases like "39 S La Salle" where CC stores it as "LaSalle" (one word).
    const streetName = extractStreetName(address);
    if (streetName && rawStreetNum) {
      const nameResults = (await searchProjects(streetName)).filter(isRealProject);
      // First try full bestVerified (name or address keyword match)
      const match6 = bestVerified(nameResults);
      if (match6) return match6;
      // Fallback: at minimum require the CC address field contains our street number
      const numVerified = nameResults.filter((p) => {
        const ccAddr = (p.address?.street_address_1 || '').toLowerCase();
        return ccAddr ? ccAddr.includes(rawStreetNum) : false;
      });
      if (numVerified.length > 0) {
        numVerified.sort((a, b) => b.updated_at - a.updated_at);
        return numVerified[0];
      }
    }

    // No match found after all strategies. Return null so the UI correctly
    // reports "no photos found" instead of returning a wrong-location result.
  }

  return null;
}

export async function getProjectPhotos(projectId: string, perPage = 50): Promise<CCPhoto[]> {
  return ccFetch(`/projects/${projectId}/photos?per_page=${perPage}`);
}

export async function downloadPhotoAsBase64(photoUrl: string): Promise<{ base64: string; contentType: string }> {
  const res = await fetch(photoUrl);
  if (!res.ok) throw new Error(`Failed to download photo: ${res.status}`);
  const buffer = await res.arrayBuffer();
  const contentType = res.headers.get('content-type') || 'image/jpeg';
  const base64 = Buffer.from(buffer).toString('base64');
  return { base64, contentType };
}
// trigger vercel rebuild
