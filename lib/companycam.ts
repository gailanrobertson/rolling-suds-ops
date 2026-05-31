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

    // Helper: true if a project is clearly identifiable as a Starbucks job.
    // Any result that doesn't pass this check is rejected — we'd rather show
    // "no photos found" than pull photos from a home estimate or unrelated job.
    const isStarbucksProject = (p: CCProject) =>
      !!(p.name && (p.name.toLowerCase().includes('starbucks') || p.name.includes(storeNumber)));

    // 3. Highway-style address: convert "Rt 83" → "IL-83" before searching.
    // CompanyCam stores addresses in IL-XX format which won't match "Rt 83".
    const highwayAddress = normalizeHighwayAddress(address);
    if (highwayAddress !== address) {
      const hwResults = await searchProjects(highwayAddress);
      const match = hwResults.filter(isRealProject).find(isStarbucksProject);
      if (match) return match;
    }

    // 4. Full address search
    const addrResults = await searchProjects(address);
    const addrMatch = addrResults.filter(isRealProject).find(isStarbucksProject);
    if (addrMatch) return addrMatch;

    // 4b. Street address only (strip city/state — trailing ", Chicago, IL 60621" can
    // confuse CompanyCam's search and prevent a match on the street portion alone).
    const streetOnly = address.split(',')[0].trim();
    if (streetOnly && streetOnly !== address.trim()) {
      const streetOnlyResults = await searchProjects(streetOnly);
      const streetOnlyMatch = streetOnlyResults.filter(isRealProject).find(isStarbucksProject);
      if (streetOnlyMatch) return streetOnlyMatch;
    }

    // 4c. Re-search using the normalized (abbreviated) address form
    if (normalizedTarget && normalizedTarget !== address.toLowerCase().trim()) {
      const normResults = await searchProjects(normalizedTarget);
      const normMatch = normResults.filter(isRealProject).find(isStarbucksProject);
      if (normMatch) return normMatch;
    }

    // 5. Street number only — handles state roads and short house numbers.
    // Lowered threshold to \d{2,} so 2-digit numbers like "39" are not skipped.
    const parts = normalizedTarget.split(' ');
    const streetNumMatch = parts[0]?.match(/^(\d{2,})/);
    const streetNum = streetNumMatch ? streetNumMatch[1] : null;
    if (streetNum) {
      const numResults = await searchProjects(streetNum);
      const numMatch = numResults.filter(isRealProject).find(isStarbucksProject);
      if (numMatch) return numMatch;
    }

    // 6. Street name + address number verification (safe street-name fallback).
    // Searches by street name then verifies the CompanyCam project's stored
    // address contains our street number AND the project is Starbucks-identified.
    // Double verification prevents pulling photos from unrelated jobs on the same street.
    const streetName = extractStreetName(address);
    const rawStreetNum = address.trim().match(/^(\d+)/)?.[1] ?? null;
    if (streetName && rawStreetNum) {
      const nameResults = await searchProjects(streetName);
      const verified = nameResults
        .filter(isRealProject)
        .filter(isStarbucksProject)
        .filter((p) => {
          const ccAddr = (p.address?.street_address_1 || '').toLowerCase();
          return ccAddr ? ccAddr.includes(rawStreetNum) : false;
        });
      if (verified.length > 0) {
        verified.sort((a, b) => b.updated_at - a.updated_at);
        return verified[0];
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
