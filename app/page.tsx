'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Job } from '@/lib/types';

export default function Dashboard() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/jobs')
      .then((r) => r.json())
      .then((data) => {
        setJobs(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const today = localDateStr();
  const tonightJobs = jobs.filter((j) => j.serviceDate === today);
  const thisWeek = getWeekDates();
  const weekJobs = jobs.filter((j) => thisWeek.includes(j.serviceDate));
  const thisMonth = localDateStr().slice(0, 7);
  const monthJobs = jobs.filter((j) => j.serviceDate.startsWith(thisMonth));
  const completed = monthJobs.filter((j) => j.status === 'completed');
  const pending = monthJobs.filter((j) => j.status !== 'completed');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-gray-400 text-sm mt-1">Starbucks Operations Overview</p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/upload"
            className="px-4 py-2 bg-[#00A4C7] text-white rounded text-sm font-medium hover:bg-[#0090b0] transition-colors"
          >
            Upload Schedule
          </Link>
          <Link
            href="/generate"
            className="px-4 py-2 bg-[#1f2937] text-gray-300 rounded text-sm font-medium hover:bg-[#374151] transition-colors border border-[#374151]"
          >
            Create Invoice
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Tonight's Jobs" value={tonightJobs.length} color={tonightJobs.length > 0 ? 'teal' : 'gray'} />
        <StatCard label="This Month" value={monthJobs.length} color="gray" />
        <StatCard label="Completed" value={completed.length} color="green" />
        <StatCard label="Pending" value={pending.length} color={pending.length > 0 ? 'yellow' : 'gray'} />
      </div>

      {/* Tonight's Jobs */}
      <section className="bg-[#111827] rounded-lg border border-[#1f2937] p-5">
        <h2 className="text-lg font-semibold text-white mb-4">
          Tonight&apos;s Jobs {tonightJobs.length > 0 && `(${tonightJobs.length})`}
        </h2>
        {loading ? (
          <p className="text-gray-500 text-sm">Loading...</p>
        ) : tonightJobs.length === 0 ? (
          <p className="text-gray-500 text-sm">No jobs scheduled for tonight.</p>
        ) : (
          <div className="grid gap-3">
            {tonightJobs.map((job) => (
              <Link
                key={job.id}
                href={`/jobs/${job.id}`}
                className="flex items-center justify-between p-3 bg-[#0a0f1a] rounded border border-[#1f2937] hover:border-[#00A4C7] transition-colors"
              >
                <div>
                  <span className="text-white font-medium">Starbucks #{job.storeNumber}</span>
                  <span className="text-gray-400 text-sm ml-3">{job.city}, {job.state}</span>
                </div>
                <div className="flex items-center gap-3">
                  {job.assignedTech && (
                    <span className="text-gray-400 text-sm">{job.assignedTech}</span>
                  )}
                  <StatusBadge status={job.status} />
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* This Week */}
      <section className="bg-[#111827] rounded-lg border border-[#1f2937] p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">This Week</h2>
          <Link href="/schedule" className="text-[#00A4C7] text-sm hover:underline">
            View Full Schedule
          </Link>
        </div>
        {loading ? (
          <p className="text-gray-500 text-sm">Loading...</p>
        ) : weekJobs.length === 0 ? (
          <p className="text-gray-500 text-sm">No jobs this week.</p>
        ) : (
          <div className="grid gap-2">
            {weekJobs.slice(0, 10).map((job) => (
              <Link
                key={job.id}
                href={`/jobs/${job.id}`}
                className="flex items-center justify-between p-2 rounded hover:bg-[#1f2937] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-gray-500 text-xs w-20">{formatDateShort(job.serviceDate)}</span>
                  <span className="text-white text-sm">#{job.storeNumber}</span>
                  <span className="text-gray-400 text-sm">{job.city}</span>
                </div>
                <StatusBadge status={job.status} />
              </Link>
            ))}
            {weekJobs.length > 10 && (
              <p className="text-gray-500 text-xs text-center pt-2">+{weekJobs.length - 10} more</p>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  const colorMap: Record<string, string> = {
    teal: 'text-[#00A4C7]',
    green: 'text-green-400',
    yellow: 'text-yellow-400',
    gray: 'text-gray-400',
  };
  return (
    <div className="bg-[#111827] rounded-lg border border-[#1f2937] p-4">
      <p className="text-gray-400 text-xs uppercase tracking-wider">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${colorMap[color] || colorMap.gray}`}>{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    scheduled: 'bg-blue-500/20 text-blue-400',
    'in-progress': 'bg-yellow-500/20 text-yellow-400',
    completed: 'bg-green-500/20 text-green-400',
  };
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${styles[status] || styles.scheduled}`}>
      {status}
    </span>
  );
}

/** Returns a YYYY-MM-DD string in local time (not UTC) to avoid day-shift bugs. */
function localDateStr(date: Date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function getWeekDates(): string[] {
  const now = new Date();
  const day = now.getDay();
  const start = new Date(now);
  start.setDate(now.getDate() - day);
  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    dates.push(localDateStr(d));
  }
  return dates;
}

function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}
