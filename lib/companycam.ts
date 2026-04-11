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
 * Filters out "Workiz NNN - Name" placeholder projects (0 photos).
 * Falls back to street number search to handle state roads like "1718 IL-171"
 * that won't match a street-name based address.
 */
export async function findStarbucksProject(
  storeNumber: string,
  woNumber?: string,
  address?: string
): Promise<CCProject | null> {
  // Skip Workiz placeholder projects — they are pre-assigned and have 0 photos
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

  // 2. Store number only: "Starbucks #00806"
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

  // 3. Full address search — filters Workiz placeholders
  if (address) {
    const addrResults = await searchProjects(address);
    const validAddr = addrResults.filter(isReal);
    if (validAddr.length > 0) {
      const preferred = validAddr.find(
        (p) => p.name && (p.name.toLowerCase().includes('starbucks') || p.name.includes(storeNumber))
      );
      return preferred || validAddr[0];
    }

    // 4. Street number only — handles state roads like "1718 IL-171"
    //    Extract just the leading street number (e.g. "1718" from "1718 S 1st Ave")
    const streetNumber = address.match(/^(\d+)/)?.[1];
    if (streetNumber && streetNumber.length >= 3) {
      const numResults = await searchProjects(streetNumber);
      const validNum = numResults.filter(isReal);
      if (validNum.length > 0) {
        // Prefer the most recently updated one (most likely the active job)
        validNum.sort((a, b) => b.updated_at - a.updated_at);
        return validNum[0];
      }
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
