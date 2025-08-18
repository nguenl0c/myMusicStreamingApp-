import React, { useEffect, useState } from 'react';
import KaraokePlayer from '../components/karaoke/KaraokePlayer';

export default function KaraokeCreator() {
  const [vocalFile, setVocalFile] = useState(null);
  const [instrumentalFile, setInstrumentalFile] = useState(null);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState(null);
  const [session, setSession] = useState(null); // { sessionId, instrumentalUrl }
  // Danh sách sessions hiện có
  const [sessions, setSessions] = useState([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [sessionsError, setSessionsError] = useState(null);
  const [active, setActive] = useState(null); // { sessionId, instrumentalUrl }

  const loadSessions = async () => {
    setLoadingSessions(true);
    setSessionsError(null);
    try {
      const res = await fetch('http://localhost:5000/api/karaoke/sessions');
      const data = await res.json();
      setSessions(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      setSessionsError(e.message || 'Không thể tải danh sách');
    } finally {
      setLoadingSessions(false);
    }
  };

  useEffect(() => { loadSessions(); }, []);

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

  const playerData = session || active;
  const handleClosePlayer = () => {
    if (session) { setSession(null); setStatus('idle'); }
    if (active) setActive(null);
    loadSessions();
  };

  if (playerData) {
    return (
      <KaraokePlayer
        sessionId={playerData.sessionId}
        instrumentalUrl={playerData.instrumentalUrl}
        onClose={handleClosePlayer}
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

      {/* Danh sách các session đã tạo */}
      <div className="mt-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-semibold">Karaoke đã tạo</h2>
          <button onClick={loadSessions} className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded disabled:opacity-50" disabled={loadingSessions}>
            {loadingSessions ? 'Đang tải...' : 'Làm mới'}
          </button>
        </div>
        {sessionsError && <div className="text-red-400 mb-3">{sessionsError}</div>}
        <div className="bg-white/5 rounded-xl p-4">
          {sessions.length === 0 && !loadingSessions && <div>Chưa có session nào.</div>}
          <div className="grid gap-3 max-h-[60vh] overflow-y-auto">
            {sessions.map(item => (
              <div key={item.sessionId} className="bg-white/5 rounded p-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-semibold truncate">{item.sessionId}</div>
                  <div className="text-xs opacity-80">
                    {item.hasLyrics ? 'Có lyrics' : 'Chưa có lyrics'}
                    {item.createdAt && ` • ${new Date(item.createdAt).toLocaleString()}`}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    className="px-3 py-1 bg-green-600 hover:bg-green-700 rounded text-sm disabled:opacity-50"
                    onClick={() => setActive({ sessionId: item.sessionId, instrumentalUrl: item.instrumentalUrl })}
                    disabled={!item.instrumentalUrl || !item.hasLyrics}
                  >
                    Play
                  </button>
                  <a
                    className="px-3 py-1 bg-white/10 rounded text-sm"
                    href={item.instrumentalUrl}
                    target="_blank" rel="noreferrer"
                  >
                    Nhạc nền
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
