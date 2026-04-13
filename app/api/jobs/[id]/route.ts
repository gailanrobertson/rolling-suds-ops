import { NextRequest, NextResponse } from 'next/server';
import { getJobById, updateJob, deleteJob } from '@/lib/db';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const job = await getJobById(id);
    if (!job) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    // Default assignedTech to Gailan Robertson if unset
    if (!job.assignedTech) job.assignedTech = 'Gailan Robertson';
    return NextResponse.json(job);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const updates = await req.json();
    const job = await updateJob(id, updates);
    if (!job) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(job);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await deleteJob(id);
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
