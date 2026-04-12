import { NextRequest, NextResponse } from 'next/server';
import { searchProjects, findStarbucksProject, getProjectPhotos } from '@/lib/companycam';

const isNotWorkiz = (p: { name: string }) =>
  !p.name || !p.name.toLowerCase().startsWith('workiz');

/**
 * GET /api/companycam?storeNumber=00806&woNumber=1963606 — find exact project + photos
 * GET /api/companycam?query=00806 — generic search
 * GET /api/companycam?projectId=123 — get photos for a specific project
 */
export async function GET(req: NextRequest) {
  try {
    const storeNumber = req.nextUrl.searchParams.get('storeNumber');
    const woNumber = req.nextUrl.searchParams.get('woNumber');
    const query = req.nextUrl.searchParams.get('query');
    const projectId = req.nextUrl.searchParams.get('projectId');

    // Direct photo fetch by project ID
    if (projectId) {
      const photos = await getProjectPhotos(projectId);
      return NextResponse.json({ success: true, photos });
    }

    // Smart Starbucks project finder
    if (storeNumber) {
      const address = req.nextUrl.searchParams.get('address');
      const project = await findStarbucksProject(storeNumber, woNumber || undefined, address || undefined);

      if (!project) {
        // Fallback search — filter out Workiz placeholders before returning to UI
        const fallbackQuery = address || `Starbucks #${storeNumber}`;
        const fallbackResults = await searchProjects(fallbackQuery);
        const filteredResults = fallbackResults.filter(isNotWorkiz);

        return NextResponse.json({
          success: true,
          matched: false,
          project: null,
          photos: [],
          searchResults: filteredResults,
          message: `No exact match for Starbucks #${storeNumber}${woNumber ? ` WO# ${woNumber}` : ''}. ${filteredResults.length} similar project(s) found.`,
        });
      }

      // Found exact match — auto-load photos
      const photos = await getProjectPhotos(project.id);
      return NextResponse.json({
        success: true,
        matched: true,
        project: { id: project.id, name: project.name },
        photos,
        earliestDate: photos.length > 0
          ? (() => {
              const minTs = Math.min(...photos.map((p: {captured_at?: number}) => p.captured_at || 0).filter(Boolean));
              const d = new Date(minTs * 1000);
              // Use local date in US Central time (UTC-5/UTC-6)
              // If hour < 12 local, assume overnight job — subtract one day
              const localHour = d.getUTCHours() - 5; // CDT offset
              if (localHour < 0 || localHour < 12) {
                d.setUTCDate(d.getUTCDate() - 1);
              }
              return d.toISOString().split('T')[0];
            })()
          : '',
        message: `Found "${project.name}" with ${photos.length} photo(s).`,
      });
    }

    // Generic search fallback
    if (query) {
      const projects = await searchProjects(query);
      return NextResponse.json({ success: true, projects });
    }

    return NextResponse.json(
      { error: 'Provide ?storeNumber= (and optionally &woNumber=), ?query=, or ?projectId=' },
      { status: 400 }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
