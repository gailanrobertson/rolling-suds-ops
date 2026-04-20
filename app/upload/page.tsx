'use client';

import { useState, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { DEFAULT_PRICE } from '@/lib/constants';
import { useTechnicians } from '@/lib/use-technicians';
import { Job, ParsedScheduleRow } from '@/lib/types';

export default function UploadPage() {
  const technicians = useTechnicians();
  const [rows, setRows] = useState<ParsedScheduleRow[]>([]);
  const [prices, setPrices] = useState<Record<number, number>>({});
  const [techs, setTechs] = useState<Record<number, string>>({});
  const [defaultTech, setDefaultTech] = useState('');
  const [pushing, setPushing] = useState(false);
  const [pushProgress, setPushProgress] = useState({ current: 0, total: 0 });
  const [message, setMessage] = useState('');
  const [dragOver, setDragOver] = useState(false);

  const handleFile = useCallback(async (file: File) => {
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      setMessage('Please upload an .xlsx or .xls file');
      return;
    }

    const XLSX = await import('xlsx');
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);

    const parsed: ParsedScheduleRow[] = jsonData.map((row) => {
      const store = String(row['Store Number'] || row['store number'] || row['StoreNumber'] || row['Store'] || row['store'] || row['Store #'] || row['store #'] || '');
      const storeMatch = store.match(/#?\s*(\d+)/);
      const storeNumber = storeMatch ? storeMatch[1].padStart(5, '0') : store;

      // Parse price from various possible column names
      const rawPrice = row['Price'] || row['price'] || row['Amount'] || row['amount']
        || row['Cost'] || row['cost'] || row['Rate'] || row['rate'] || '';
      const parsedPrice = Number(rawPrice);

      return {
        night: Number(row['Night #'] || row['night #'] || row['Night'] || row['night'] || 0),
        date: parseDate(row['Date'] || row['date']),
        store,
        storeNumber,
        address: String(row['Address'] || row['address'] || ''),
        city: String(row['City'] || row['city'] || ''),
        state: String(row['State'] || row['state'] || 'IL'),
        price: parsedPrice > 0 ? parsedPrice : undefined,
      };
    });

    setRows(parsed);
    // Pre-populate prices from spreadsheet if available
    const initialPrices: Record<number, number> = {};
    parsed.forEach((row, i) => {
      if (row.price) initialPrices[i] = row.price;
    });
    if (Object.keys(initialPrices).length > 0) setPrices(initialPrices);
    setMessage(`Parsed ${parsed.length} jobs from ${file.name}`);
  }, []);

  async function saveLocally() {
    const jobs: Job[] = rows.map((row, i) => ({
      id: uuidv4(),
      storeNumber: row.storeNumber,
      address: row.address,
      city: row.city,
      state: row.state,
      price: prices[i] ?? DEFAULT_PRICE,
      serviceDate: row.date,
      nightNumber: row.night,
      assignedTech: techs[i] || defaultTech || undefined,
      status: 'scheduled' as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));

    const res = await fetch('/api/jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(jobs),
    });

    if (res.ok) {
      setMessage(`Saved ${jobs.length} jobs! Redirecting to schedule...`);
      setTimeout(() => { window.location.href = '/schedule'; }, 1500);
    } else {
      const data = await res.json().catch(() => ({}));
      setMessage(`Failed to save: ${data.error || 'Unknown error'}`);
    }
  }

  async function pushToWorkiz() {
    setPushing(true);
    setPushProgress({ current: 0, total: rows.length });
    let succeeded = 0;
    let failed = 0;
    const errors: string[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        const res = await fetch('/api/workiz/jobs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clientFirstName: `Starbucks #${row.storeNumber}`,
            jobAddress: row.address,
            jobCity: row.city,
            jobState: row.state,
            jobDescription: `Pressure Wash Patio/Sidewalk/Drive Thru - Starbucks #${row.storeNumber}`,
            jobDateTime: row.date,
            jobType: 'Commercial',
          }),
        });
        const data = await res.json();
        if (res.ok && !data.error) {
          succeeded++;
        } else {
          failed++;
          errors.push(`#${row.storeNumber}: ${data.error || `HTTP ${res.status}`}`);
        }
      } catch (err) {
        failed++;
        errors.push(`#${row.storeNumber}: ${err instanceof Error ? err.message : 'Network error'}`);
      }
      setPushProgress({ current: i + 1, total: rows.length });
    }

    setPushing(false);
    if (failed === 0) {
      setMessage(`Successfully pushed ${succeeded} jobs to Workiz!`);
    } else {
      setMessage(`Workiz: ${succeeded} succeeded, ${failed} failed. Errors: ${errors.slice(0, 3).join('; ')}${errors.length > 3 ? ` ...and ${errors.length - 3} more` : ''}`);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Upload Schedule</h1>
        <p className="text-gray-400 text-sm mt-1">Import Starbucks schedule from .xlsx file</p>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const file = e.dataTransfer.files[0];
          if (file) handleFile(file);
        }}
        className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
          dragOver ? 'border-[#00A4C7] bg-[#00A4C7]/10' : 'border-[#374151] bg-[#111827]'
        }`}
      >
        <p className="text-gray-400 mb-3">Drag & drop an .xlsx file here, or</p>
        <label className="px-4 py-2 bg-[#00A4C7] text-white rounded text-sm font-medium hover:bg-[#0090b0] transition-colors cursor-pointer">
          Choose File
          <input
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
          />
        </label>
      </div>

      {message && (
        <div className="bg-[#111827] border border-[#1f2937] rounded p-3 text-sm text-[#00A4C7]">
          {message}
        </div>
      )}

      {/* Preview */}
      {rows.length > 0 && (
        <div className="bg-[#111827] rounded-lg border border-[#1f2937] p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-white">{rows.length} Jobs Parsed</h2>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-400">All Prices:</label>
                <input
                  type="number"
                  placeholder="350"
                  className="w-20 bg-[#0a0f1a] border border-[#374151] rounded px-2 py-1 text-sm text-gray-100"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const val = Number((e.target as HTMLInputElement).value);
                      if (val > 0) {
                        const newPrices: Record<number, number> = {};
                        rows.forEach((_, i) => { newPrices[i] = val; });
                        setPrices(newPrices);
                      }
                    }
                  }}
                />
                <button
                  onClick={() => {
                    const input = document.querySelector<HTMLInputElement>('input[placeholder="350"]');
                    const val = Number(input?.value);
                    if (val > 0) {
                      const newPrices: Record<number, number> = {};
                      rows.forEach((_, i) => { newPrices[i] = val; });
                      setPrices(newPrices);
                    }
                  }}
                  className="px-2 py-1 bg-[#374151] text-gray-300 rounded text-xs hover:bg-[#4b5563] transition-colors"
                >
                  Set All
                </button>
              </div>
              <label className="text-sm text-gray-400">Default Tech:</label>
              <select
                value={defaultTech}
                onChange={(e) => setDefaultTech(e.target.value)}
                className="bg-[#0a0f1a] border border-[#374151] rounded px-2 py-1 text-sm text-gray-100"
              >
                <option value="">None</option>
                {technicians.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-400 border-b border-[#1f2937]">
                  <th className="pb-2 pr-3">Night</th>
                  <th className="pb-2 pr-3">Date</th>
                  <th className="pb-2 pr-3">Store #</th>
                  <th className="pb-2 pr-3">Address</th>
                  <th className="pb-2 pr-3">City</th>
                  <th className="pb-2 pr-3">Price</th>
                  <th className="pb-2">Tech</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i} className="border-b border-[#1f2937]/50">
                    <td className="py-2 pr-3 text-gray-400">{row.night}</td>
                    <td className="py-2 pr-3 text-gray-300">{row.date}</td>
                    <td className="py-2 pr-3 text-white font-mono">{row.storeNumber}</td>
                    <td className="py-2 pr-3 text-gray-300">{row.address}</td>
                    <td className="py-2 pr-3 text-gray-300">{row.city}, {row.state}</td>
                    <td className="py-2 pr-3">
                      <input
                        type="number"
                        value={prices[i] ?? DEFAULT_PRICE}
                        onChange={(e) => setPrices((p) => ({ ...p, [i]: Number(e.target.value) }))}
                        className="w-20 bg-[#0a0f1a] border border-[#374151] rounded px-2 py-1 text-sm text-gray-100"
                      />
                    </td>
                    <td className="py-2">
                      <select
                        value={techs[i] || defaultTech}
                        onChange={(e) => setTechs((t) => ({ ...t, [i]: e.target.value }))}
                        className="bg-[#0a0f1a] border border-[#374151] rounded px-2 py-1 text-sm text-gray-100"
                      >
                        <option value="">Unassigned</option>
                        {technicians.map((t) => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex gap-3 pt-4 border-t border-[#1f2937]">
            <button
              onClick={saveLocally}
              className="px-5 py-2.5 bg-[#00A4C7] text-white rounded text-sm font-medium hover:bg-[#0090b0] transition-colors"
            >
              Save Locally
            </button>
            <button
              onClick={pushToWorkiz}
              disabled={pushing}
              className="px-5 py-2.5 bg-green-600 text-white rounded text-sm font-medium hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              {pushing
                ? `Pushing to Workiz (${pushProgress.current}/${pushProgress.total})`
                : 'Push to Workiz'}
            </button>
          </div>

          {pushing && (
            <div className="w-full bg-[#0a0f1a] rounded-full h-2">
              <div
                className="bg-[#00A4C7] h-2 rounded-full transition-all"
                style={{ width: `${(pushProgress.current / pushProgress.total) * 100}%` }}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function parseDate(val: unknown): string {
  if (!val) return '';
  if (typeof val === 'number') {
    // Excel serial date
    const date = new Date((val - 25569) * 86400 * 1000);
    return date.toISOString().split('T')[0];
  }
  const str = String(val);
  const d = new Date(str);
  if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
  return str;
}
