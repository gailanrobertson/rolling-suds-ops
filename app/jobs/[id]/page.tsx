'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Job } from '@/lib/types';
import { DEFAULT_PRICE } from '@/lib/constants';
import { useTechnicians } from '@/lib/use-technicians';

interface CCProject {
  id: string;
  name: string;
}

interface CCPhoto {
  id: string;
  urls?: { original?: string; thumbnail?: string };
  uris?: Array<{ type: string; uri: string }>;
  uri?: string;
  photo_url?: string;
  captured_at?: number;
  created_at?: number;
}

export default function JobDetailPage() {
  const technicians = useTechnicians();
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // CompanyCam state
  const [ccProjects, setCcProjects] = useState<CCProject[]>([]);
  const [ccPhotos, setCcPhotos] = useState<CCPhoto[]>([]);
  const [selectedPhotos, setSelectedPhotos] = useState<Set<string>>(new Set());
  const [manualPhotos, setManualPhotos] = useState<Array<{id: string; dataUrl: string; name: string}>>([]);
  const [ccSearching, setCcSearching] = useState(false);
  const [ccLoadingPhotos, setCcLoadingPhotos] = useState(false);
  const [ccError, setCcError] = useState('');

  // Email state
  const [emailConfigured, setEmailConfigured] = useState(false);
  const [sendingDocs, setSendingDocs] = useState(false);
  const [sendingPhotos, setSendingPhotos] = useState(false);
  const [emailStatus, setEmailStatus] = useState('');

  function refreshJob() {
    fetch(`/api/jobs/${id}`).then((r) => r.json()).then(setJob).catch(() => {});
  }

  useEffect(() => {
    fetch(`/api/jobs/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error('Not found');
        return r.json();
      })
      .then(setJob)
      .catch(() => setJob(null))
      .finally(() => setLoading(false));

    fetch('/api/email')
      .then((r) => r.json())
      .then((d) => setEmailConfigured(d.configured))
      .catch(() => {});
  }, [id]);

  async function updateField(field: string, value: string | number) {
    if (!job) return;
    const updated = { ...job, [field]: value, updatedAt: new Date().toISOString() };
    setJob(updated);
    await fetch(`/api/jobs/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: value }),
    });
  }

  async function updateStatus(status: Job['status']) {
    await updateField('status', status);
  }

  async function generateDoc(type: 'invoice' | 'work-order' | 'both') {
    if (!job) return;
    setSaving(true);
    try {
      const { generateInvoicePDF } = await import('@/lib/pdf/invoice');
      const { generateWorkOrderPDF } = await import('@/lib/pdf/work-order');

      if (type === 'invoice' || type === 'both') {
        const inv = generateInvoicePDF({
          storeNumber: job.storeNumber, woNumber: job.woNumber || '',
          invoiceNumber: job.invoiceNumber || '', price: job.price || DEFAULT_PRICE,
          serviceDate: job.serviceDate, address: job.address,
          city: job.city, state: job.state, zip: job.zip || '',
        });
        inv.save(`Invoice_${job.storeNumber}.pdf`);
      }
      if (type === 'work-order' || type === 'both') {
        const wo = generateWorkOrderPDF({
          storeNumber: job.storeNumber, woNumber: job.woNumber || '',
          address: job.address, city: job.city, state: job.state,
          zip: job.zip || '', storePhone: job.storePhone || '',
          serviceDate: job.serviceDate, technician: job.assignedTech || '',
          startTime: job.startTime || '', stopTime: job.stopTime || '',
        });
        wo.save(`WO_${job.storeNumber}.pdf`);
      }
    } catch (err) {
      console.error(err);
    }
    setSaving(false);
  }

  // ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ CompanyCam ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ

  const [ccMatchedProject, setCcMatchedProject] = useState<string>('');

  async function searchCompanyCam() {
    if (!job) return;
    setCcSearching(true);
    setCcError('');
    setCcPhotos([]);
    setCcProjects([]);
    setSelectedPhotos(new Set());
    setCcMatchedProject('');

    try {
      // Smart search: uses exact naming convention "Starbucks #00806 WO# 1963606"
      const params = new URLSearchParams({ storeNumber: job.storeNumber });
      if (job.woNumber) params.set('woNumber', job.woNumber);
      if (job.address) params.set('address', job.address);

      const res = await fetch(`/api/companycam?${params}`);
      const data = await res.json();

      if (!data.success) {
        setCcError(data.error || 'Search failed.');
        setCcSearching(false);
        return;
      }

      if (data.matched && data.project) {
        // Exact match found ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ photos already loaded
        setCcMatchedProject(data.project.name);
        const photos = data.photos || [];
        setCcPhotos(photos);
        // Auto-select all photos (typically exactly 5)
        const allUrls = photos.map((p: CCPhoto) => getPhotoUrl(p)).filter(Boolean);
        setSelectedPhotos(new Set(allUrls));
        // Auto-fill start/stop times from photo timestamps
        autoFillTimesFromPhotos(photos);
      } else {
        // No exact match ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ show search results for manual selection
        setCcProjects(data.searchResults || []);
        if ((data.searchResults || []).length === 0) {
          setCcError(`No CompanyCam projects found for Starbucks #${job.storeNumber}.`);
        } else {
          setCcError(data.message || 'No exact match. Select a project below.');
        }
      }
    } catch {
      setCcError('Failed to connect to CompanyCam.');
    }
    setCcSearching(false);
  }

  async function loadPhotos(projectId: string, projectName?: string) {
    setCcLoadingPhotos(true);
    setCcError('');
    try {
      const res = await fetch(`/api/companycam?projectId=${projectId}`);
      const data = await res.json();
      if (data.success && data.photos) {
        const photos = data.photos;
        setCcPhotos(photos);
        setCcProjects([]);
        setCcMatchedProject(projectName || '');
        // Auto-select all photos
        const allUrls = photos.map((p: CCPhoto) => getPhotoUrl(p)).filter(Boolean);
        setSelectedPhotos(new Set(allUrls));
        // Auto-fill start/stop times from photo timestamps
        autoFillTimesFromPhotos(photos);
      }
    } catch {
      setCcError('Failed to load photos.');
    }
    setCcLoadingPhotos(false);
  }

  function getPhotoUrl(photo: CCPhoto): string {
    if (photo.urls?.original) return photo.urls.original;
    if (photo.uris?.length) {
      const original = photo.uris.find((u) => u.type === 'original');
      if (original) return original.uri;
      return photo.uris[0].uri;
    }
    return photo.uri || photo.photo_url || '';
  }

  function getThumbUrl(photo: CCPhoto): string {
    if (photo.urls?.thumbnail) return photo.urls.thumbnail;
    return getPhotoUrl(photo);
  }

  async function autoFillTimesFromPhotos(photos: CCPhoto[]) {
    if (!job || photos.length === 0) return;
    // Get timestamps from photos (captured_at or created_at)
    const timestamps = photos
      .map((p) => p.captured_at || p.created_at || 0)
      .filter((t) => t > 0);
    if (timestamps.length === 0) return;

    const earliest = Math.min(...timestamps);
    const latest = Math.max(...timestamps);

    // CompanyCam may return seconds or milliseconds ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ normalize
    const toTimeStr = (ts: number) => {
      const ms = ts < 10000000000 ? ts * 1000 : ts;
      const d = new Date(ms);
      return d.getHours().toString().padStart(2, '0') + ':' + d.getMinutes().toString().padStart(2, '0');
    };

    const startStr = toTimeStr(earliest);
    const stopStr = toTimeStr(latest);

    // Update both via single API call to avoid state race condition
    const updates: Record<string, string> = {};
    if (!job.startTime) updates.startTime = startStr;
    if (!job.stopTime) updates.stopTime = stopStr;

    if (Object.keys(updates).length > 0) {
      const updated = { ...job, ...updates, updatedAt: new Date().toISOString() };
      setJob(updated);
      await fetch(`/api/jobs/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
    }
  }

  function togglePhoto(url: string) {
    setSelectedPhotos((prev) => {
      const next = new Set(prev);
      if (next.has(url)) next.delete(url);
      else next.add(url);
      return next;
    });
  }

  // ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ Email sending ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ

  function handleManualUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const dataUrl = ev.target?.result as string;
        const id = `manual-${Date.now()}-${Math.random()}`;
        setManualPhotos((prev) => [...prev, { id, dataUrl, name: file.name }]);
        setSelectedPhotos((prev) => new Set([...prev, dataUrl]));
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  }

  function removeManualPhoto(id: string, dataUrl: string) {
    setManualPhotos((prev) => prev.filter((p) => p.id !== id));
    setSelectedPhotos((prev) => { const next = new Set(prev); next.delete(dataUrl); return next; });
  }

  async function sendDocumentsEmail(test = false) {
    if (!job) return;
    setSendingDocs(true);
    setEmailStatus('');
    try {
      const res = await fetch('/api/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'documents',
          test,
          jobId: job.id,
          storeNumber: job.storeNumber,
          woNumber: job.woNumber || '',
          invoiceData: {
            invoiceNumber: job.invoiceNumber || '',
            price: job.price || DEFAULT_PRICE,
            serviceDate: job.serviceDate,
            address: job.address,
            city: job.city,
            state: job.state,
            zip: job.zip || '',
          },
          workOrderData: {
            address: job.address,
            city: job.city,
            state: job.state,
            zip: job.zip || '',
            storePhone: job.storePhone || '',
            serviceDate: job.serviceDate,
            technician: job.assignedTech || '',
            startTime: job.startTime || '',
            stopTime: job.stopTime || '',
          },
        }),
      });
      const data = await res.json();
      if (data.success) {
        setEmailStatus(test ? 'Test sent to your email' :'Documents sent to documents@gosuperclean.com');
        refreshJob();
      } else {
        setEmailStatus(`Failed: ${data.error}`);
      }
    } catch (err) {
      setEmailStatus('Failed to send documents email.');
      console.error(err);
    }
    setSendingDocs(false);
  }

  async function sendPhotosEmail(test = false) {
    if (!job || selectedPhotos.size === 0) return;
    setSendingPhotos(true);
    setEmailStatus('');
    try {
      const res = await fetch('/api/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'photos',
          test,
          jobId: job.id,
          storeNumber: job.storeNumber,
          woNumber: job.woNumber || '',
          photoUrls: Array.from(selectedPhotos),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setEmailStatus(test ? 'Test sent to your email' :'Photos sent to starbucks@gosuperclean.com');
        refreshJob();
      } else {
        setEmailStatus(`Failed: ${data.error}`);
      }
    } catch (err) {
      setEmailStatus('Failed to send photos email.');
      console.error(err);
    }
    setSendingPhotos(false);
  }

  if (loading) return <p className="text-gray-500 text-center py-20">Loading...</p>;
  if (!job) return (
    <div className="text-center py-20">
      <p className="text-gray-500 mb-4">Job not found</p>
      <button onClick={() => router.push('/schedule')} className="text-[#00A4C7] hover:underline">Back to Schedule</button>
    </div>
  );

  const docsSent = job.emailLogs?.some((l) => l.type === 'documents' && !l.test);
  const photosSent = job.emailLogs?.some((l) => l.type === 'photos' && !l.test);

  const statusColors: Record<string, string> = {
    scheduled: 'bg-blue-500',
    'in-progress': 'bg-yellow-500',
    completed: 'bg-green-500',
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <button onClick={() => router.back()} className="text-gray-400 hover:text-white text-sm mb-2 block">&larr; Back</button>
          <h1 className="text-2xl font-bold text-white">Starbucks #{job.storeNumber}</h1>
          <p className="text-gray-400 text-sm">{job.address}, {job.city}, {job.state} {job.zip}</p>
        </div>
        <div className={`w-3 h-3 rounded-full ${statusColors[job.status]}`} />
      </div>

      {/* Job Details */}
      <div className="bg-[#111827] rounded-lg border border-[#1f2937] p-6 space-y-4">
        <div>
          <label className="block text-sm text-gray-400 mb-2">Status</label>
          <div className="flex gap-2">
            {(['scheduled', 'in-progress', 'completed'] as const).map((s) => (
              <button
                key={s}
                onClick={() => updateStatus(s)}
                className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                  job.status === s
                    ? 'bg-[#00A4C7] text-white'
                    : 'bg-[#0a0f1a] text-gray-400 border border-[#374151] hover:border-[#00A4C7]'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <EditField label="WO #" value={job.woNumber || ''} onSave={(v) => updateField('woNumber', v)} />
          <EditField label="Invoice #" value={job.invoiceNumber || ''} onSave={(v) => updateField('invoiceNumber', v)} />
          <div>
            <label className="block text-sm text-gray-400 mb-1">Assigned Tech</label>
            <select
              value={job.assignedTech || ''}
              onChange={(e) => updateField('assignedTech', e.target.value)}
              className="w-full bg-[#0a0f1a] border border-[#374151] rounded px-3 py-2 text-sm text-gray-100"
            >
              <option value="">Unassigned</option>
              {technicians.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <EditField label="Price" value={String(job.price || DEFAULT_PRICE)} type="number" onSave={(v) => updateField('price', Number(v))} />
          <EditField label="Service Date" value={job.serviceDate} type="date" onSave={(v) => updateField('serviceDate', v)} />
          <EditField label="Night #" value={String(job.nightNumber || '')} type="number" onSave={(v) => updateField('nightNumber', Number(v))} />
          <EditField label="Start Time" value={job.startTime || ''} type="time" onSave={(v) => updateField('startTime', v)} />
          <EditField label="Stop Time" value={job.stopTime || ''} type="time" onSave={(v) => updateField('stopTime', v)} />
          <EditField label="Zip" value={job.zip || ''} onSave={(v) => updateField('zip', v)} />
          <EditField label="Store Phone" value={job.storePhone || ''} onSave={(v) => updateField('storePhone', v)} />
        </div>
      </div>

      {/* Documents */}
      <div className="bg-[#111827] rounded-lg border border-[#1f2937] p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Documents</h2>
        <div className="flex flex-wrap gap-3">
          <button onClick={() => generateDoc('invoice')} disabled={saving}
            className="px-4 py-2 bg-[#00A4C7] text-white rounded text-sm font-medium hover:bg-[#0090b0] transition-colors disabled:opacity-50">
            Generate Invoice PDF
          </button>
          <button onClick={() => generateDoc('work-order')} disabled={saving}
            className="px-4 py-2 bg-[#00A4C7] text-white rounded text-sm font-medium hover:bg-[#0090b0] transition-colors disabled:opacity-50">
            Generate Work Order PDF
          </button>
          <button onClick={() => generateDoc('both')} disabled={saving}
            className="px-4 py-2 bg-green-600 text-white rounded text-sm font-medium hover:bg-green-700 transition-colors disabled:opacity-50">
            Download Both
          </button>
        </div>
      </div>

      {/* CompanyCam Photos */}
      <div className="bg-[#111827] rounded-lg border border-[#1f2937] p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-white">CompanyCam Photos</h2>
            {ccMatchedProject && (
              <p className="text-green-400 text-xs mt-1">Matched: {ccMatchedProject}</p>
            )}
          </div>
          <button
            onClick={searchCompanyCam}
            disabled={ccSearching}
            className="px-4 py-2 bg-[#00A4C7] text-white rounded text-sm font-medium hover:bg-[#0090b0] transition-colors disabled:opacity-50"
          >
            {ccSearching ? 'Searching...' : ccPhotos.length > 0 ? 'Refresh' : 'Find Photos'}
          </button>
        </div>

        {!ccSearching && ccPhotos.length === 0 && ccProjects.length === 0 && !ccError && (
          <p className="text-gray-500 text-sm mb-3">
            Click &quot;Find Photos&quot; to search for project &quot;Starbucks #{job.storeNumber}{job.woNumber ? ` WO# ${job.woNumber}` : ''}&quot;
          </p>
        )}

        {ccError && <p className="text-yellow-400 text-sm mb-3">{ccError}</p>}

        {/* Fallback: manual project selection when no exact match */}
        {ccProjects.length > 0 && ccPhotos.length === 0 && (
          <div className="space-y-2 mb-4">
            <p className="text-gray-400 text-sm">Select the correct project:</p>
            {ccProjects.map((p) => (
              <button
                key={p.id}
                onClick={() => loadPhotos(p.id, p.name)}
                disabled={ccLoadingPhotos}
                className="block w-full text-left p-3 bg-[#0a0f1a] border border-[#374151] rounded hover:border-[#00A4C7] transition-colors"
              >
                <span className="text-white text-sm font-medium">{p.name}</span>
                <span className="text-gray-500 text-xs ml-2">Click to load photos</span>
              </button>
            ))}
          </div>
        )}

        {ccLoadingPhotos && <p className="text-gray-500 text-sm">Loading photos...</p>}

        {/* Manual photo upload */}
        <div className="mt-4 pt-4 border-t border-[#1f2937]">
          <div className="flex items-center justify-between mb-3">
            <p className="text-gray-400 text-sm font-medium">Upload Photos Manually</p>
            <label className="px-3 py-1.5 bg-[#374151] text-gray-300 rounded text-xs font-medium hover:bg-[#4b5563] transition-colors cursor-pointer">
              + Add Photos
              <input type="file" accept="image/*" multiple onChange={handleManualUpload} className="hidden" />
            </label>
          </div>
          {manualPhotos.length > 0 ? (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
              {manualPhotos.map((photo) => {
                const selected = selectedPhotos.has(photo.dataUrl);
                return (
                  <div key={photo.id} className="relative aspect-square rounded overflow-hidden border-2 border-[#00A4C7]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photo.dataUrl} alt={photo.name} className="w-full h-full object-cover" />
                    <button onClick={() => togglePhoto(photo.dataUrl)} className={`absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center text-white text-xs font-bold ${selected ? 'bg-[#00A4C7]' : 'bg-gray-600'}`}>
                      {selected ? 'ÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ' : 'ÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ'}
                    </button>
                    <button onClick={() => removeManualPhoto(photo.id, photo.dataUrl)} className="absolute top-1 left-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                      ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-gray-600 text-xs">No manually uploaded photos yet.</p>
          )}
        </div>

        {/* Photo grid */}
        {ccPhotos.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-gray-400 text-sm">
                {ccPhotos.length} photo(s) ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ {selectedPhotos.size} selected
                {selectedPhotos.size === ccPhotos.length && ccPhotos.length > 0 && (
                  <span className="text-green-400 ml-1">(all selected)</span>
                )}
              </p>
              <button
                onClick={() => {
                  if (selectedPhotos.size === ccPhotos.length) {
                    setSelectedPhotos(new Set());
                  } else {
                    setSelectedPhotos(new Set(ccPhotos.map((p) => getPhotoUrl(p)).filter(Boolean)));
                  }
                }}
                className="text-[#00A4C7] text-xs hover:underline"
              >
                {selectedPhotos.size === ccPhotos.length ? 'Deselect All' : 'Select All'}
              </button>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
              {ccPhotos.map((photo) => {
                const url = getPhotoUrl(photo);
                const thumb = getThumbUrl(photo);
                const selected = selectedPhotos.has(url);
                return (
                  <button
                    key={photo.id}
                    onClick={() => togglePhoto(url)}
                    className={`relative aspect-square rounded overflow-hidden border-2 transition-colors ${
                      selected ? 'border-[#00A4C7]' : 'border-transparent'
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={thumb}
                      alt={`Photo ${photo.id}`}
                      className="w-full h-full object-cover"
                    />
                    {selected && (
                      <div className="absolute top-1 right-1 w-5 h-5 bg-[#00A4C7] rounded-full flex items-center justify-center text-white text-xs font-bold">
                        &#10003;
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Email Sending */}
      <div className="bg-[#111827] rounded-lg border border-[#1f2937] p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Send Emails</h2>

        {!emailConfigured && (
          <p className="text-yellow-400 text-sm mb-4">
            Email not configured. Set RESEND_API_KEY in .env.local
          </p>
        )}

        <div className="space-y-4">
          {/* Documents email */}
          <div className="p-4 bg-[#0a0f1a] rounded border border-[#1f2937]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white text-sm font-medium">
                  Invoice + Work Order
                  {docsSent && <span className="ml-2 text-green-400 text-xs font-normal">Sent</span>}
                </p>
                <p className="text-gray-500 text-xs">To: documents@gosuperclean.com</p>
                <p className="text-gray-500 text-xs">Attachments: Invoice PDF, Signed Work Order PDF</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => sendDocumentsEmail(true)}
                  disabled={sendingDocs || !emailConfigured || !job.woNumber}
                  className="px-3 py-2 bg-[#374151] text-gray-300 rounded text-xs font-medium hover:bg-[#4b5563] transition-colors disabled:opacity-50"
                >
                  Test to Me
                </button>
                <button
                  onClick={() => sendDocumentsEmail(false)}
                  disabled={sendingDocs || !emailConfigured || !job.woNumber}
                  className="px-4 py-2 bg-[#00A4C7] text-white rounded text-sm font-medium hover:bg-[#0090b0] transition-colors disabled:opacity-50"
                >
                  {sendingDocs ? 'Sending...' : docsSent ? 'Resend Documents' : 'Send Documents'}
                </button>
              </div>
            </div>
            {!job.woNumber && (
              <p className="text-yellow-500 text-xs mt-2">WO # required before sending</p>
            )}
          </div>

          {/* Photos email */}
          <div className="p-4 bg-[#0a0f1a] rounded border border-[#1f2937]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white text-sm font-medium">
                  Service Photos ({selectedPhotos.size} selected)
                  {photosSent && <span className="ml-2 text-green-400 text-xs font-normal">Sent</span>}
                </p>
                <p className="text-gray-500 text-xs">To: starbucks@gosuperclean.com</p>
                <p className="text-gray-500 text-xs">Attachments: {selectedPhotos.size} photo(s) from CompanyCam</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => sendPhotosEmail(true)}
                  disabled={sendingPhotos || !emailConfigured || selectedPhotos.size === 0}
                  className="px-3 py-2 bg-[#374151] text-gray-300 rounded text-xs font-medium hover:bg-[#4b5563] transition-colors disabled:opacity-50"
                >
                  Test to Me
                </button>
                <button
                  onClick={() => sendPhotosEmail(false)}
                  disabled={sendingPhotos || !emailConfigured || selectedPhotos.size === 0}
                  className="px-4 py-2 bg-[#00A4C7] text-white rounded text-sm font-medium hover:bg-[#0090b0] transition-colors disabled:opacity-50"
                >
                  {sendingPhotos ? 'Sending...' : photosSent ? 'Resend Photos' : 'Send Photos'}
                </button>
              </div>
            </div>
            {selectedPhotos.size === 0 && (
              <p className="text-yellow-500 text-xs mt-2">Select photos from CompanyCam above first</p>
            )}
          </div>
        </div>

        {emailStatus && (
          <div className={`mt-4 p-3 rounded text-sm ${
            emailStatus.startsWith('Failed')
              ? 'bg-red-500/10 border border-red-500/30 text-red-400'
              : 'bg-green-500/10 border border-green-500/30 text-green-400'
          }`}>
            {emailStatus}
          </div>
        )}

        {/* Email send log */}
        {job.emailLogs && job.emailLogs.length > 0 && (
          <div className="mt-4 pt-4 border-t border-[#1f2937]">
            <h3 className="text-sm font-semibold text-white mb-2">Email Log</h3>
            <div className="space-y-1">
              {job.emailLogs.map((log, i) => (
                <div key={i} className="flex items-center justify-between text-xs p-2 bg-[#0a0f1a] rounded">
                  <div className="flex items-center gap-2">
                    <span className={`px-1.5 py-0.5 rounded font-medium ${
                      log.type === 'documents' ? 'bg-blue-500/20 text-blue-400' : 'bg-purple-500/20 text-purple-400'
                    }`}>
                      {log.type === 'documents' ? 'Docs' : 'Photos'}
                    </span>
                    {log.test && <span className="text-yellow-400">[TEST]</span>}
                    <span className="text-gray-400">to {log.to}</span>
                  </div>
                  <span className="text-gray-500">
                    {new Date(log.sentAt).toLocaleString('en-US', {
                      month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true
                    })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Workiz sync info */}
      {job.workizJobId && (
        <div className="bg-[#111827] rounded-lg border border-[#1f2937] p-4 text-sm text-gray-400">
          Workiz Job ID: <span className="text-white font-mono">{job.workizJobId}</span>
        </div>
      )}

      {/* Workiz */}
      <div className="bg-[#111827] rounded-lg border border-[#1f2937] p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Workiz</h2>
        {job.workizJobId && (
          <p className="text-gray-400 text-sm mb-3">
            Job ID: <span className="text-white font-mono">{job.workizJobId}</span>
          </p>
        )}
        <div className="flex flex-wrap gap-3">
          {!job.workizJobId && (
            <button
              onClick={async () => {
                setEmailStatus('');
                try {
                  const res = await fetch('/api/workiz/jobs', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      FirstName: `Starbucks #${job.storeNumber}`,
                      LastName: 'Fuentes',
                      Address: job.address,
                      City: job.city,
                      State: job.state,
                      Country: 'US',
                      PostalCode: job.zip || '',
                      ...(job.storePhone ? { Phone: job.storePhone.replace(/\D/g, '') } : {}),
                      Email: 'documents@gosuperclean.com',
                      JobType: 'SOFT WASHING',
                      JobSource: 'National Accounts',
                      JobDateTime: (job.serviceDate || new Date().toISOString().split('T')[0]) + ' 22:00',
                      JobNotes: `Starbucks #${job.storeNumber} WO# ${job.woNumber || ''}`,
                    }),
                  });
                  const data = await res.json();
                  if (data.error || !data.success) {
                    setEmailStatus(`Workiz push failed: ${data.error || 'Unknown error'}`);
                  } else {
                    const workizUuid = data?.data?.UUID || data?.data?.uuid;
                    if (workizUuid) {
                      await updateField('workizJobId', workizUuid);
                    }
                    setEmailStatus(data.mode === 'mock' ? 'Workiz (mock): job push simulated' : 'Job pushed to Workiz!');
                  }
                } catch {
                  setEmailStatus('Failed to push to Workiz.');
                }
              }}
              className="px-4 py-2 bg-[#00A4C7] text-white rounded text-sm font-medium hover:bg-[#0090b0] transition-colors"
            >
              Push Job to Workiz
            </button>
          )}
          <button
            onClick={async () => {
              if (!job.workizJobId) { setEmailStatus('Push job to Workiz first.'); return; }
              setEmailStatus('');
              try {
                const res = await fetch('/api/workiz/invoice', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    JobUUID: job.workizJobId,
                    Items: [{
                      description: `Pressure Wash Patio/Sidewalk/Drive Thru - Starbucks #${job.storeNumber}`,
                      quantity: 1,
                      price: job.price || 350,
                    }],
                  }),
                });
                const data = await res.json();
                if (data.error || !data.success) {
                  setEmailStatus(`Workiz invoice failed: ${data.error || 'Unknown error'}`);
                } else {
                  setEmailStatus(data.mode === 'mock' ? 'Workiz (mock): invoice creation simulated' : 'Invoice created in Workiz!');
                }
              } catch {
                setEmailStatus('Failed to create Workiz invoice.');
              }
            }}
            disabled={!job.workizJobId}
            className="px-4 py-2 bg-[#00A4C7] text-white rounded text-sm font-medium hover:bg-[#0090b0] transition-colors disabled:opacity-50"
          >
            Create Invoice in Workiz
          </button>
        </div>
        {!job.workizJobId && (
          <p className="text-gray-500 text-xs mt-2">Push this job to Workiz first to enable invoice creation</p>
        )}
      </div>
    </div>
  );
}

function EditField({
  label,
  value,
  type = 'text',
  onSave,
}: {
  label: string;
  value: string;
  type?: string;
  onSave: (v: string) => void;
}) {
  const [localVal, setLocalVal] = useState(value);
  const [editing, setEditing] = useState(false);

  const displayVal = editing ? localVal : value;

  function handleBlur() {
    setEditing(false);
    if (localVal !== value) {
      onSave(localVal);
    }
  }

  return (
    <div>
      <label className="block text-sm text-gray-400 mb-1">{label}</label>
      <input
        type={type}
        value={displayVal}
        onFocus={() => { setEditing(true); setLocalVal(value); }}
        onChange={(e) => { setLocalVal(e.target.value); }}
        onBlur={handleBlur}
        onKeyDown={(e) => { if (e.key === 'Enter') handleBlur(); }}
        className="w-full bg-[#0a0f1a] border border-[#374151] rounded px-3 py-2 text-sm text-gray-100 focus:border-[#00A4C7] focus:outline-none"
      />
    </div>
  );
}
