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

  // 2. Store number: "Starbucks #00806"
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

  if (address) {
    // 3. Full address search
    const addrResults = await searchProjects(address);
    const validAddr = addrResults.filter(isRealProject);
    if (validAddr.length > 0) {
      const preferred = validAddr.find(
        (p) => p.name && (p.name.toLowerCase().includes('starbucks') || p.name.includes(storeNumber))
      );
      return preferred || validAddr[0];
    }

    // 4. Street number only — handles state roads (e.g. "1718 IL-171" vs "1718 S 1st Ave")
    const parts = address.trim().split(' ');
    const streetNum = parts[0];
    if (streetNum && /^[0-9]{3,}$/.test(streetNum)) {
      const numResults = await searchProjects(streetNum);
      const validNum = numResults.filter(isRealProject);
      if (validNum.length > 0) {
        validNum.sort((a, b) => b.updated_at - a.updated_at);
        return validNum[0];
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
