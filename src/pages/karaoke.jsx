import React, { useCallback, useEffect, useRef, useState } from 'react';
import { fetchStems } from '../services/mixerApi';
import KaraokeView from '../components/mixer/KaraokeView';
import { startTranscription } from '../services/mixerApi';

export default function KaraokePage() {
  const [songs, setSongs] = useState([]);
  const [selected, setSelected] = useState(null); // { songFolderName, song, trackId }
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [statusMap, setStatusMap] = useState({});
  const pollRef = useRef(null);

  const loadSongs = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetchStems();
      setSongs(res.data || []);
    } catch (e) {
      console.error('fetchStems failed', e);
      setError('Không thể tải thư viện stems');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { loadSongs(); }, [loadSongs]);
  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  const handleTranscribe = async (song) => {
    try {
      const trackId = song.trackId;
      if (!trackId) return;
      setStatusMap(prev => ({ ...prev, [trackId]: { status: 'starting', done: false } }));
      await startTranscription(trackId);
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = setInterval(async () => {
        try {
          const res = await fetch(`http://localhost:5000/api/transcribe-progress/${trackId}`);
          const data = await res.json();
          setStatusMap(prev => ({ ...prev, [trackId]: data }));
          if (data.done) {
            clearInterval(pollRef.current);
          }
        } catch (err) {
          console.error('Poll whisper failed', err);
        }
      }, 1000);
    } catch (err) {
      console.error('Start transcription failed', err);
      alert('Không thể trích xuất lời.');
    }
  };

  return (
    <div className="p-6 text-white">
      <h1 className="text-3xl font-bold mb-4">Karaoke</h1>
      {error && <div className="mb-3 text-red-400">{error}</div>}
      <div className="bg-white/5 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xl font-semibold">Các bài đã tách</h2>
          <button onClick={loadSongs} className="px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-700">Làm mới</button>
        </div>
        {isLoading ? (
          <div>Đang tải...</div>
        ) : (
          <div className="grid gap-3 max-h-[50vh] overflow-y-auto">
            {songs.map(song => (
              <div key={song.trackId} className="bg-white/5 rounded-lg p-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate" title={song.song}>{song.song}</div>
                  <div className="text-xs text-gray-300">{Object.keys(song.stems || {}).length} stems</div>
                </div>
                <button
                  className="px-3 py-1 rounded-lg bg-purple-600 hover:bg-purple-700 text-sm"
                  onClick={() => handleTranscribe(song)}
                >
                  {statusMap[song.trackId]?.status === 'processing' ? 'Đang trích...' : 'Trích lời'}
                </button>
                <button
                  className="px-3 py-1 rounded-lg bg-yellow-600 hover:bg-yellow-700 text-sm"
                  onClick={() => setSelected(song)}
                >
                  Karaoke
                </button>
              </div>
            ))}
            {songs.length === 0 && <div className="text-gray-400">Chưa có bài nào</div>}
          </div>
        )}
      </div>

      {selected && (
        <KaraokeView song={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}
