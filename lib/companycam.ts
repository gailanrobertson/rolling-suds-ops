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

/**
 * Search CompanyCam projects by query string
 */
export async function searchProjects(query: string): Promise<CCProject[]> {
  const encoded = encodeURIComponent(query);
  return ccFetch(`/projects?query=${encoded}&per_page=25`);
}

/**
 * Find the exact CompanyCam project for a Starbucks store.
 * Projects are named like: "Starbucks #00806 WO# 1963606"
 *
 * Strategy:
 * 1. Search with full name "Starbucks #XXXXX WO# YYYYYYY" (exact match)
 * 2. If no match, search "Starbucks #XXXXX" (store only)
 * 3. Filter results to verify the store number is actually in the project name
 */
export async function findStarbucksProject(
  storeNumber: string,
  woNumber?: string,
  address?: string
): Promise<CCProject | null> {
  // Try exact search first: "Starbucks #00806 WO# 1963606"
  if (woNumber) {
    const exactQuery = `Starbucks #${storeNumber} WO# ${woNumber}`;
    const exactResults = await searchProjects(exactQuery);
    const exactMatch = exactResults.find((p) =>
      p.name.includes(`#${storeNumber}`) && p.name.includes(woNumber)
    );
    if (exactMatch) return exactMatch;
  }

  // Fallback: search by store number only
  const storeQuery = `Starbucks #${storeNumber}`;
  const storeResults = await searchProjects(storeQuery);

  // Filter to projects that actually contain this store number in the name
  const matches = storeResults.filter((p) =>
    p.name.includes(`#${storeNumber}`)
  );

  if (matches.length > 0) {
    // If WO number provided, prefer a match that contains it
    if (woNumber) {
      const woMatch = matches.find((p) => p.name.includes(woNumber));
      if (woMatch) return woMatch;
    }
    // Return most recently updated match
    matches.sort((a, b) => b.updated_at - a.updated_at);
    return matches[0];
  }

  // Fallback: search by address
  if (address) {
    const addrResults = await searchProjects(address);
    if (addrResults.length > 0) {
      // Prefer results that mention the store number or "Starbucks"
      const starbucksMatch = addrResults.find((p) =>
        p.name && (p.name.toLowerCase().includes('starbucks') || p.name.includes(storeNumber))
      );
      if (starbucksMatch) return starbucksMatch;
      // Otherwise return the first result (likely matched by address)
      return addrResults[0];
    }
  }

  return null;
}

/**
 * Get all photos for a project
 */
export async function getProjectPhotos(projectId: string, perPage = 50): Promise<CCPhoto[]> {
  return ccFetch(`/projects/${projectId}/photos?per_page=${perPage}`);
}

/**
 * Download a photo and return as base64
 */
export async function downloadPhotoAsBase64(photoUrl: string): Promise<{ base64: string; contentType: string }> {
  const res = await fetch(photoUrl);
  if (!res.ok) throw new Error(`Failed to download photo: ${res.status}`);
  const buffer = await res.arrayBuffer();
  const contentType = res.headers.get('content-type') || 'image/jpeg';
  const base64 = Buffer.from(buffer).toString('base64');
  return { base64, contentType };
}
