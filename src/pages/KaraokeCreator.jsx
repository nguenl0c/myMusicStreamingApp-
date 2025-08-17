import React, { useState } from 'react';
import KaraokePlayer from '../components/karaoke/KaraokePlayer';

export default function KaraokeCreator() {
  const [vocalFile, setVocalFile] = useState(null);
  const [instrumentalFile, setInstrumentalFile] = useState(null);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState(null);
  const [session, setSession] = useState(null); // { sessionId, instrumentalUrl }

  const handleStart = async () => {
    setError(null);
    if (!vocalFile || !instrumentalFile) {
      setError('Vui lòng chọn đủ 2 file.');
      return;
    }
    try {
      setStatus('uploading');
      const fd = new FormData();
      fd.append('vocalTrack', vocalFile);
      fd.append('instrumentalTrack', instrumentalFile);
      const res = await fetch('http://localhost:5000/api/karaoke/create', {
        method: 'POST',
        body: fd,
      });
      if (!res.ok) throw new Error(`Tạo session thất bại: ${res.status}`);
      const data = await res.json();
      setSession(data);
      setStatus('processing');
      // Tùy chọn: có thể poll trạng thái, nhưng lyrics.json được tạo ngay trong cùng thư mục; KaraokePlayer sẽ tải khi mount
    } catch (e) {
      console.error(e);
      setError(e.message || 'Lỗi không xác định');
      setStatus('idle');
    }
  };

  if (session) {
    return (
      <KaraokePlayer
        sessionId={session.sessionId}
        instrumentalUrl={session.instrumentalUrl}
        onClose={() => { setSession(null); setStatus('idle'); }}
      />
    );
  }

  return (
    <div className="p-6 text-white screen-container min-h-screen">
      <h1 className="text-3xl font-bold mb-6">Tạo Karaoke của riêng bạn</h1>
      <div className="grid gap-6 max-w-xl">
        <div>
          <label className="block mb-2 font-semibold">Tải lên bài hát gốc (có lời)</label>
          <input type="file" accept=".mp3,.wav,.m4a" onChange={e => setVocalFile(e.target.files?.[0] || null)} className="block w-full" />
          {vocalFile && <div className="text-sm opacity-80 mt-1">{vocalFile.name}</div>}
        </div>
        <div>
          <label className="block mb-2 font-semibold">Tải lên nhạc nền (không lời)</label>
          <input type="file" accept=".mp3,.wav,.m4a" onChange={e => setInstrumentalFile(e.target.files?.[0] || null)} className="block w-full" />
          {instrumentalFile && <div className="text-sm opacity-80 mt-1">{instrumentalFile.name}</div>}
        </div>
        <div className="flex items-center gap-3">
          <button onClick={handleStart} className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded disabled:opacity-50" disabled={status==='uploading'}>
            Bắt đầu tạo Karaoke
          </button>
          {status !== 'idle' && (
            <div className="text-sm opacity-80">
              {status === 'uploading' && 'Đang upload...'}
              {status === 'processing' && 'Đang trích xuất lời...'}
            </div>
          )}
          {error && <div className="text-red-400 text-sm">{error}</div>}
        </div>
      </div>
    </div>
  );
}
