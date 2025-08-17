import React, { useCallback, useEffect, useRef, useState } from 'react';
import { fetchStems, startTranscription } from '../services/mixerApi';
import KaraokeView from '../components/karaoke/KaraokeView';

export default function KaraokePage() {
  const [songs, setSongs] = useState([]);
  const [selected, setSelected] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [statusMap, setStatusMap] = useState({});
  const [model, setModel] = useState('small');
  const [language, setLanguage] = useState('auto');
  const [stemChoice, setStemChoice] = useState({});
  const pollRef = useRef({}); // Dùng object để quản lý nhiều interval

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

  // Dọn dẹp tất cả interval khi component unmount
  useEffect(() => {
    const pollIds = Object.values(pollRef.current);
    return () => {
      pollIds.forEach(clearInterval);
    };
  }, []);

  const handleTranscribe = async (song) => {
    const trackId = song.trackId;
    if (!trackId) return;

    const chosenStem = stemChoice[trackId];
    if (!chosenStem) {
      alert('Vui lòng chọn stem để trích lời.');
      return;
    }

    try {
      setStatusMap(prev => ({ ...prev, [trackId]: { status: 'starting', done: false, model, language } }));

      // **SỬA LỖI QUAN TRỌNG:** Thêm `engine: 'stable'` vào request body.
      // Điều này báo cho backend phải sử dụng script karaoke.py mới của chúng ta
      // thay vì fallback về logic cũ tạo file .srt.
      await startTranscription(trackId, {
        model,
        language,
        stemFile: chosenStem,
        engine: 'stable' // Bắt buộc dùng engine mới
      });

      // Xóa interval cũ nếu có
      if (pollRef.current[trackId]) clearInterval(pollRef.current[trackId]);

      // Bắt đầu polling cho trackId này
      pollRef.current[trackId] = setInterval(async () => {
        try {
          const res = await fetch(`http://localhost:5000/api/transcribe-progress/${trackId}`);
          const data = await res.json();
          setStatusMap(prev => ({ ...prev, [trackId]: data }));
          if (data.done) {
            clearInterval(pollRef.current[trackId]);
            delete pollRef.current[trackId]; // Xóa khỏi object sau khi hoàn tất
            // Tự động làm mới danh sách để cập nhật trạng thái (tùy chọn)
            // loadSongs(); 
          }
        } catch (err) {
          console.error('Poll whisper failed for', trackId, err);
          clearInterval(pollRef.current[trackId]); // Dừng polling nếu có lỗi
          delete pollRef.current[trackId];
        }
      }, 2000); // Tăng thời gian polling lên 2s
    } catch (err) {
      console.error('Start transcription failed', err);
      setStatusMap(prev => ({ ...prev, [trackId]: { status: 'error', error: 'Không thể bắt đầu trích xuất.' } }));
    }
  };

  return (
    <div className="p-6 text-white screen-container">
      <h1 className="text-3xl font-bold mb-4">Karaoke</h1>
      <div className="flex flex-wrap gap-3 mb-4 items-end">
        <div>
          <label className="block text-sm mb-1">Model</label>
          <select value={model} onChange={e => setModel(e.target.value)} className="bg-white/10 border border-white/10 rounded px-2 py-1">
            <option value="tiny">tiny (nhanh nhất, kém chính xác)</option>
            <option value="base">base</option>
            <option value="small">small (mặc định)</option>
            <option value="medium">medium</option>
            <option value="large-v3">large-v3 (chính xác, rất nặng)</option>
            <option value="large-v3-turbo">large-v3-turbo (nhanh hơn v3)</option>
          </select>
        </div>
        <div>
          <label className="block text-sm mb-1">Ngôn ngữ</label>
          <select value={language} onChange={e => setLanguage(e.target.value)} className="bg-white/10 border border-white/10 rounded px-2 py-1">
            <option value="auto">Tự động</option>
            <option value="vi">Tiếng Việt</option>
            <option value="en">English</option>
          </select>
        </div>
      </div>
      {error && <div className="mb-3 text-red-400">{error}</div>}
      <div className="bg-white/5 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xl font-semibold">Các bài đã tách</h2>
          <button onClick={loadSongs} className="px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50" disabled={isLoading}>
            {isLoading ? 'Đang tải...' : 'Làm mới'}
          </button>
        </div>
        {isLoading ? (
          <div>Đang tải danh sách...</div>
        ) : (
          <div className="grid gap-3 max-h-[50vh] overflow-y-auto">
            {songs.map(song => (
              <div key={song.trackId} className="bg-white/5 rounded-lg p-3 flex flex-col gap-2">
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold truncate" title={song.song}>{song.song}</div>
                    <div className="text-xs text-gray-300">{Object.keys(song.stems || {}).length} stems</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-gray-300">Stem:</label>
                    <select
                      className="bg-white/10 border border-white/10 rounded px-2 py-1 text-sm"
                      value={stemChoice[song.trackId] || ''}
                      onChange={e => setStemChoice(prev => ({ ...prev, [song.trackId]: e.target.value }))}
                    >
                      <option value="" disabled>-- chọn stem --</option>
                      {Object.values(song.stems || {}).map((info) => {
                        try {
                          const decoded = decodeURIComponent(info.url.substring(info.url.lastIndexOf('/') + 1));
                          return <option key={decoded} value={decoded}>{decoded}</option>;
                        } catch {
                          const fallback = info.url.substring(info.url.lastIndexOf('/') + 1);
                          return <option key={fallback} value={fallback}>{fallback}</option>;
                        }
                      })}
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      className="px-3 py-1 rounded-lg bg-purple-600 hover:bg-purple-700 text-sm disabled:opacity-50"
                      onClick={() => handleTranscribe(song)}
                      disabled={!stemChoice[song.trackId] || statusMap[song.trackId]?.status === 'processing' || statusMap[song.trackId]?.status === 'downloading'}
                    >
                      {statusMap[song.trackId]?.status === 'downloading' ? 'Đang tải model…' : (statusMap[song.trackId]?.status === 'processing' ? 'Đang trích…' : 'Trích lời')}
                    </button>
                    <button
                      className="px-3 py-1 rounded-lg bg-yellow-600 hover:bg-yellow-700 text-sm"
                      onClick={() => setSelected(song)}
                    >
                      Karaoke
                    </button>
                  </div>
                </div>
                {statusMap[song.trackId] && (
                  <div className="text-xs text-gray-300 whitespace-pre-wrap max-h-24 overflow-y-auto bg-black/20 rounded p-2">
                    Trạng thái: {statusMap[song.trackId].status}
                    {statusMap[song.trackId].error ? `\nLỗi: ${statusMap[song.trackId].error}` : ''}
                  </div>
                )}
              </div>
            ))}
            {songs.length === 0 && !isLoading && <div className="text-gray-400">Chưa có bài hát nào được tách stem.</div>}
          </div>
        )}
      </div>

      {selected && (
        <KaraokeView song={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}
