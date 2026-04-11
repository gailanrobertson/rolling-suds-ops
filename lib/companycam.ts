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
 * Filters out "Workiz NNN - Name" placeholder projects which have 0 photos.
 */
export async function findStarbucksProject(
  storeNumber: string,
  woNumber?: string,
  address?: string
): Promise<CCProject | null> {
  // Workiz placeholder projects start with "Workiz" — skip them always
  const isReal = (p: CCProject) =>
    !p.name || !p.name.toLowerCase().startsWith('workiz');

  // 1. Exact search: "Starbucks #00806 WO# 1963606"
  if (woNumber) {
    const exactResults = await searchProjects(`Starbucks #${storeNumber} WO# ${woNumber}`);
    const match = exactResults.find(
      (p) => p.name && p.name.includes(`#${storeNumber}`) && p.name.includes(woNumber) && isReal(p)
    );
    if (match) return match;
  }

  // 2. Store number search: "Starbucks #00806" — skip Workiz results
  const storeResults = await searchProjects(`Starbucks #${storeNumber}`);
  const storeMatches = storeResults.filter(
    (p) => p.name && p.name.includes(`#${storeNumber}`) && isReal(p)
  );
  if (storeMatches.length > 0) {
    if (woNumber) {
      const woMatch = storeMatches.find((p) => p.name.includes(woNumber));
      if (woMatch) return woMatch;
    }
    storeMatches.sort((a, b) => b.updated_at - a.updated_at);
    return storeMatches[0];
  }

  // 3. Address fallback — skip Workiz results
  if (address) {
    const addrResults = await searchProjects(address);
    const validResults = addrResults.filter(isReal);
    if (validResults.length > 0) {
      const preferred = validResults.find(
        (p) => p.name && (p.name.toLowerCase().includes('starbucks') || p.name.includes(storeNumber))
      );
      return preferred || validResults[0];
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
