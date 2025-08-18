import React, { useEffect, useState } from 'react';
import KaraokePlayer from '../components/karaoke/KaraokePlayer';

export default function KaraokeSessions() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [active, setActive] = useState(null); // { sessionId, instrumentalUrl }

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('http://localhost:5000/api/karaoke/sessions');
      const data = await res.json();
      setList(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      setError(e.message || 'Không thể tải danh sách');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  if (active) {
    return (
      <KaraokePlayer
        sessionId={active.sessionId}
        instrumentalUrl={active.instrumentalUrl}
        onClose={() => setActive(null)}
      />
    );
  }

  return (
    <div className="p-6 text-white screen-container min-h-screen">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-3xl font-bold">Karaoke Sessions</h1>
        <button onClick={load} className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded disabled:opacity-50" disabled={loading}>
          {loading ? 'Đang tải...' : 'Làm mới'}
        </button>
      </div>
      {error && <div className="text-red-400 mb-4">{error}</div>}
      <div className="bg-white/5 rounded-xl p-4">
        {list.length === 0 && !loading && <div>Chưa có session nào.</div>}
        <div className="grid gap-3 max-h-[70vh] overflow-y-auto">
          {list.map(item => (
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
  );
}
