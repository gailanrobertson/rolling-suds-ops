'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Job } from '@/lib/types';
import { useTechnicians } from '@/lib/use-technicians';

type ViewMode = 'week' | 'month';

export default function SchedulePage() {
  const technicians = useTechnicians();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [view, setView] = useState<ViewMode>('week');
  const [currentDate, setCurrentDate] = useState(() => {
    if (typeof window === 'undefined') return new Date();
    const saved = sessionStorage.getItem('schedule-current-date');
    if (!saved) return new Date();
    const d = new Date(saved);
    return isNaN(d.getTime()) ? new Date() : d;
  });
  useEffect(() => {
    sessionStorage.setItem('schedule-current-date', currentDate.toISOString());
  }, [currentDate]);
  const [selectedJobs, setSelectedJobs] = useState<Set<string>>(new Set());
  const [bulkTech, setBulkTech] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/jobs')
      .then((r) => r.json())
      .then((data) => { setJobs(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const dates = view === 'week' ? getWeekDates(currentDate) : getMonthDates(currentDate);

  function navigate(dir: number) {
    const d = new Date(currentDate);
    if (view === 'week') d.setDate(d.getDate() + dir * 7);
    else d.setMonth(d.getMonth() + dir);
    setCurrentDate(d);
  }

  function toggleSelect(id: string) {
    setSelectedJobs((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function bulkAssign() {
    if (!bulkTech || selectedJobs.size === 0) return;
    const updated = jobs.map((j) =>
      selectedJobs.has(j.id) ? { ...j, assignedTech: bulkTech, updatedAt: new Date().toISOString() } : j
    );

    for (const id of selectedJobs) {
      const job = updated.find((j) => j.id === id);
      if (job) {
        await fetch(`/api/jobs/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ assignedTech: bulkTech }),
        });
      }
    }

    setJobs(updated);
    setSelectedJobs(new Set());
    setBulkTech('');
  }

  const headerLabel = view === 'week'
    ? `Week of ${dates[0]?.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
    : currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Schedule</h1>
        <div className="flex items-center gap-2">
          <button onClick={() => setView('week')} className={`px-3 py-1 rounded text-sm ${view === 'week' ? 'bg-[#00A4C7] text-white' : 'text-gray-400 hover:text-white'}`}>Week</button>
          <button onClick={() => setView('month')} className={`px-3 py-1 rounded text-sm ${view === 'month' ? 'bg-[#00A4C7] text-white' : 'text-gray-400 hover:text-white'}`}>Month</button>
        </div>
      </div>

      {/* Bulk assign */}
      {selectedJobs.size > 0 && (
        <div className="bg-[#111827] border border-[#00A4C7] rounded-lg p-3 flex items-center gap-3">
          <span className="text-sm text-[#00A4C7]">{selectedJobs.size} selected</span>
          <select
            value={bulkTech}
            onChange={(e) => setBulkTech(e.target.value)}
            className="bg-[#0a0f1a] border border-[#374151] rounded px-2 py-1 text-sm text-gray-100"
          >
            <option value="">Assign tech...</option>
            {technicians.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <button onClick={bulkAssign} disabled={!bulkTech} className="px-3 py-1 bg-[#00A4C7] text-white rounded text-sm disabled:opacity-50">Assign</button>
          <button onClick={() => setSelectedJobs(new Set())} className="px-3 py-1 text-gray-400 hover:text-white text-sm">Clear</button>
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-white px-3 py-1">&larr; Prev</button>
        <span className="text-white font-medium">{headerLabel}</span>
        <button onClick={() => navigate(1)} className="text-gray-400 hover:text-white px-3 py-1">Next &rarr;</button>
      </div>

      {loading ? (
        <p className="text-gray-500 text-center py-10">Loading...</p>
      ) : (
        <div className={`grid ${view === 'week' ? 'grid-cols-7' : 'grid-cols-7'} gap-1`}>
          {/* Day headers */}
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
            <div key={d} className="text-center text-xs text-gray-500 py-1">{d}</div>
          ))}

          {dates.map((date) => {
            const dateStr = localDateStr(date);
            const dayJobs = jobs.filter((j) => j.serviceDate === dateStr);
            const isToday = dateStr === localDateStr();

            return (
              <div
                key={dateStr}
                className={`min-h-[100px] bg-[#111827] rounded border p-2 ${
                  isToday ? 'border-[#00A4C7]' : 'border-[#1f2937]'
                }`}
              >
                <div className={`text-xs mb-1 ${isToday ? 'text-[#00A4C7] font-bold' : 'text-gray-500'}`}>
                  {date.getDate()}
                </div>
                {dayJobs.map((job) => (
                  <div
                    key={job.id}
                    className={`text-xs p-1 mb-1 rounded cursor-pointer border ${
                      selectedJobs.has(job.id) ? 'border-[#00A4C7]' : 'border-transparent'
                    } ${
                      job.status === 'completed'
                        ? 'bg-green-900/30 text-green-400'
                        : job.assignedTech
                        ? 'bg-blue-900/30 text-blue-400'
                        : 'bg-red-900/30 text-red-400'
                    }`}
                    onClick={(e) => {
                      if (e.shiftKey || e.ctrlKey || e.metaKey) {
                        toggleSelect(job.id);
                      }
                    }}
                  >
                    <Link href={`/jobs/${job.id}`} className="block">
                      <div className="font-mono">#{job.storeNumber}</div>
                      <div className="text-[10px] opacity-70 truncate">{job.city}</div>
                      {job.assignedTech && (
                        <div className="text-[10px] opacity-50 truncate">{job.assignedTech.split(' ')[0]}</div>
                      )}
                    </Link>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}

      <div className="text-xs text-gray-500 flex gap-4">
        <span><span className="inline-block w-3 h-3 rounded bg-red-900/30 mr-1"></span>Unassigned</span>
        <span><span className="inline-block w-3 h-3 rounded bg-blue-900/30 mr-1"></span>Assigned</span>
        <span><span className="inline-block w-3 h-3 rounded bg-green-900/30 mr-1"></span>Completed</span>
        <span className="text-gray-600">Shift+Click to select multiple for bulk assign</span>
      </div>
    </div>
  );
}

/** Returns a YYYY-MM-DD string in local time (not UTC) to avoid day-shift bugs. */
function localDateStr(date: Date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function getWeekDates(d: Date): Date[] {
  const start = new Date(d);
  start.setDate(d.getDate() - d.getDay());
  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    return date;
  });
}

function getMonthDates(d: Date): Date[] {
  const year = d.getFullYear();
  const month = d.getMonth();
  const first = new Date(year, month, 1);
  const startDay = first.getDay();
  const dates: Date[] = [];
  // fill from start of week
  for (let i = -startDay; i < 35; i++) {
    const date = new Date(year, month, 1 + i);
    dates.push(date);
  }
  return dates;
}
