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

    // 3. Full address search with tolerant matching
    const addrResults = await searchProjects(address);
    const validAddr = addrResults.filter(isRealProject);
    if (validAddr.length > 0) {
      const strong = validAddr.filter((p) => {
        if (!p.name) return false;
        const np = normalizeAddress(p.name);
        return np && normalizedTarget && (np.includes(normalizedTarget) || normalizedTarget.includes(np));
      });
      const pool = strong.length > 0 ? strong : validAddr;
      const preferred = pool.find(
        (p) => p.name && (p.name.toLowerCase().includes('starbucks') || p.name.includes(storeNumber))
      );
      return preferred || pool[0];
    }

    // 3b. Re-search using the normalized (abbreviated) address form
    if (normalizedTarget && normalizedTarget !== address.toLowerCase().trim()) {
      const normResults = await searchProjects(normalizedTarget);
      const validNorm = normResults.filter(isRealProject);
      if (validNorm.length > 0) {
        const strong = validNorm.filter((p) => {
          if (!p.name) return false;
          const np = normalizeAddress(p.name);
          return np && (np.includes(normalizedTarget) || normalizedTarget.includes(np));
        });
        const pool = strong.length > 0 ? strong : validNorm;
        const preferred = pool.find(
          (p) => p.name && (p.name.toLowerCase().includes('starbucks') || p.name.includes(storeNumber))
        );
        return preferred || pool[0];
      }
    }

    // 4. Street number only - handles state roads (e.g. "1718 IL-171" vs "1718 S 1st Ave")
    const parts = normalizedTarget.split(' ');
    const streetNum = parts[0];
    if (streetNum && /^[0-9]{3,}$/.test(streetNum)) {
      const numResults = await searchProjects(streetNum);
      const validNum = numResults.filter(isRealProject);
      if (validNum.length > 0) {
        validNum.sort((a, b) => b.updated_at - a.updated_at);
        return validNum[0];
      }
    }

    // 5. Street-name fallback - "Mannheim" in the last 30 days, with photos.
    const streetName = extractStreetName(address);
    if (streetName && streetName.length >= 3) {
      const streetResults = await searchProjects(streetName);
      const thirtyDaysAgoMs = Date.now() - 30 * 24 * 60 * 60 * 1000;
      const recent = streetResults.filter((p) => {
        if (!p.updated_at) return false;
        if ((p.photo_count ?? 0) === 0) return false;
        return toMillis(p.updated_at) >= thirtyDaysAgoMs;
      });
      if (recent.length > 0) {
        recent.sort((a, b) => b.updated_at - a.updated_at);
        return recent[0];
      }
    }
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
