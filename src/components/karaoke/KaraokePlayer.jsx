import React, { useState, useEffect, useRef } from 'react';
import { fetchKaraokeLyrics, saveKaraokeLyrics } from '../../services/karaokeApi';
import { useKaraokePlayer } from '../../hooks/useKaraokePlayer';
import { FaPlay, FaPause } from 'react-icons/fa';

// Component Word: hiển thị từng từ với lớp vàng chạy phủ chữ xám
const Word = ({ wordData, currentTime }) => {
  const { word, start, end } = wordData;
  const EPS = 0.05; // epsilon để tránh lỗi rơi đúng ranh giới thời gian

  const isPast = currentTime >= end - EPS;
  const isActive = currentTime >= start - EPS && currentTime < end + EPS;

  let progress = 0;
  if (isPast) {
    progress = 100;
  } else if (isActive) {
    const duration = Math.max(0.0001, end - start);
    progress = ((currentTime - start) / duration) * 100;
  }
  // Clamp 0..100
  progress = Math.max(0, Math.min(100, progress));

  return (
    // Lớp container chính, không thay đổi
    <span className="relative inline-block mr-2 whitespace-nowrap align-baseline">
      {/* Lớp chữ xám ở dưới, không thay đổi */}
      <span className="text-gray-400 select-none">{word}</span>

      {/* KHẮC PHỤC LỖI:
          - Lớp bên ngoài (div) chỉ làm nhiệm vụ cắt theo chiều rộng (width).
          - Lớp bên trong (span) sẽ chứa chữ màu vàng, đảm bảo nó có đủ chiều cao
            để không bị cắt mất phần đuôi.
      */}
      <div
        className="absolute left-0 top-0 -bottom-[3px] overflow-hidden pointer-events-none"
        style={{ width: `${progress}%` }}
      >
        <span className="text-blue-400">{word}</span>
      </div>
    </span>
  );
};


export default function KaraokePlayer({ data, onBack }) {
  const { sessionId, instrumentalUrl, songName } = data;
  const [lyrics, setLyrics] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [draftLyrics, setDraftLyrics] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const player = useKaraokePlayer();
  const activeLineRef = useRef(null);
  const listRef = useRef(null);
  // Offset để bù lệch lời với nhạc (giây). Có thể âm/dương.
  const [lyricOffset, setLyricOffset] = useState(0);

  // useEffect để tải dữ liệu (nhạc và lời) khi component được mount
  useEffect(() => {
    const loadData = async () => {
      try {
        // Tải lời bài hát
        const lyricsData = await fetchKaraokeLyrics(sessionId);
  setLyrics(lyricsData);
  setDraftLyrics(lyricsData);

        // Tải nhạc nền
        const fullUrl = /^https?:\/\//i.test(instrumentalUrl)
          ? instrumentalUrl
          : `http://localhost:5000${instrumentalUrl}`;
        player.load(fullUrl);

        // Đảm bảo danh sách bắt đầu ở đầu (tránh bị neo giữa màn hình)
        requestAnimationFrame(() => {
          if (listRef.current) listRef.current.scrollTop = 0;
        });

      } catch (err) {
        console.error(err);
        setError("Không thể tải dữ liệu karaoke.");
      } finally {
        setIsLoading(false);
      }
    };

    loadData();

    // Hàm cleanup sẽ được gọi khi component unmount
    return () => player.cleanup();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, instrumentalUrl]);

  // useEffect để tự động cuộn theo lời bài hát
  useEffect(() => {
    if (activeLineRef.current) {
      activeLineRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [player.currentTime]); // Theo dõi sự thay đổi của currentTime

  // Hàm định dạng thời gian cho đẹp hơn
  const handlePlayPause = async () => {
    try {
      if (player.isPlaying) {
        player.pause();
      } else {
        await player.play();
      }
    } catch (e) {
      console.error('Không thể phát nhạc:', e);
    }
  };

  const formatTime = (seconds) => {
    if (isNaN(seconds) || seconds < 0) return "00:00";
    return new Date(seconds * 1000).toISOString().substr(14, 5);
  }

  // Helpers for editing
  const toSeconds = (mmss) => {
    if (typeof mmss === 'number') return mmss;
    if (!mmss) return 0;
    const parts = String(mmss).split(':');
    if (parts.length === 1) return parseFloat(parts[0]) || 0;
    const m = parseFloat(parts[0]) || 0;
    const s = parseFloat(parts[1]) || 0;
    return m * 60 + s;
  };

  const recalcWordsEvenly = (line) => {
    const words = (line.text || '').trim().split(/\s+/).filter(Boolean);
    const start = toSeconds(line.start);
    const end = toSeconds(line.end);
    const duration = Math.max(0.001, end - start);
    if (words.length === 0) {
      return { ...line, words: [] };
    }
    const step = duration / words.length;
    const newWords = words.map((w, i) => {
      const ws = start + i * step;
      const we = i === words.length - 1 ? end : start + (i + 1) * step;
      return { word: w, start: ws, end: we };
    });
    return { ...line, words: newWords };
  };

  const normalizeDraftFromLyrics = (arr) => arr.map((line) => ({
    start: line.start,
    end: line.end,
    text: (line.words || []).map(w => w.word).join(' '),
    words: line.words || [],
  }));

  const buildLyricsFromDraft = (arr) => arr.map((line) => {
    const start = toSeconds(line.start);
    const end = toSeconds(line.end);
    const base = { start, end };
    // Nếu người dùng đã nhập text, tính lại words đều nhau
    const hasText = typeof line.text === 'string';
    const hasWords = Array.isArray(line.words) && line.words.length > 0;
    if (hasText) {
      return { ...base, words: recalcWordsEvenly(line).words };
    }
    if (hasWords) {
      // cập nhật time về seconds nếu user đổi
      const words = line.words.map(w => ({ ...w, start: toSeconds(w.start), end: toSeconds(w.end) }));
      return { ...base, words };
    }
    return { ...base, words: [] };
  });

  const startEdit = () => {
    setDraftLyrics(normalizeDraftFromLyrics(lyrics));
    setIsEditing(true);
  };

  const cancelEdit = () => {
    setDraftLyrics(normalizeDraftFromLyrics(lyrics));
    setIsEditing(false);
  };

  const saveEdit = async () => {
    try {
      setIsSaving(true);
      const newLyrics = buildLyricsFromDraft(draftLyrics);
      await saveKaraokeLyrics(sessionId, newLyrics);
      setLyrics(newLyrics);
      setIsEditing(false);
    } catch (e) {
      console.error('Lưu lời thất bại:', e);
      alert('Lưu lời thất bại.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-6 text-white screen-container flex flex-col h-full max-h-screen">
      {/* Header */}
      <div className="flex justify-between items-center flex-shrink-0">
        <button onClick={onBack} className="btn btn-ghost">Quay lại</button>
        <h2 className="text-xl font-bold truncate text-center">{songName || 'Karaoke'}</h2>
        <div className="w-24"></div> {/* Spacer để căn giữa tiêu đề */}
      </div>

      {/* Khu vực hiển thị lời hoặc chỉnh sửa */}
      <div className="flex-grow flex items-stretch justify-start text-center overflow-hidden my-4">
        {isLoading ? <p>Đang tải...</p> : error ? <p className="text-red-400">{error}</p> : (
          isEditing ? (
            <div className="w-full h-full overflow-y-auto p-2 text-left">
              <table className="table table-zebra w-full text-sm">
                <thead className="sticky top-0 bg-base-200">
                  <tr>
                    <th>#</th>
                    <th>Bắt đầu (mm:ss)</th>
                    <th>Kết thúc (mm:ss)</th>
                    <th>Lời</th>
                  </tr>
                </thead>
                <tbody>
                  {draftLyrics.map((line, i) => (
                    <tr key={i}>
                      <td className="w-10 text-center">{i + 1}</td>
                      <td className="w-32">
                        <input
                          type="text"
                          className="input input-sm input-bordered w-full"
                          value={typeof line.start === 'number' ? formatTime(line.start) : line.start}
                          onChange={(e) => {
                            const v = e.target.value;
                            setDraftLyrics(prev => prev.map((l, idx) => idx === i ? { ...l, start: v } : l));
                          }}
                        />
                      </td>
                      <td className="w-32">
                        <input
                          type="text"
                          className="input input-sm input-bordered w-full"
                          value={typeof line.end === 'number' ? formatTime(line.end) : line.end}
                          onChange={(e) => {
                            const v = e.target.value;
                            setDraftLyrics(prev => prev.map((l, idx) => idx === i ? { ...l, end: v } : l));
                          }}
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          className="input input-sm input-bordered w-full"
                          value={line.text}
                          onChange={(e) => {
                            const v = e.target.value;
                            setDraftLyrics(prev => prev.map((l, idx) => idx === i ? recalcWordsEvenly({ ...l, text: v }) : l));
                          }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div ref={listRef} className="h-full w-full overflow-y-auto overflow-x-clip p-4 flex flex-col">
              {lyrics.map((line, index) => {
                const EPS = 0.05;
                const t = Math.max(0, player.currentTime + lyricOffset);
                const isActiveLine = t >= line.start - EPS && t < line.end + EPS;
                return (
                  <p
                    key={index}
                    ref={isActiveLine ? activeLineRef : null}
                    className={`text-3xl md:text-4xl font-bold transition-all duration-300 p-2 transform ${isActiveLine ? 'scale-110' : 'text-gray-300 scale-90'}`}
                  >
                    {line.words.map((word, wordIndex) => (
                      <Word key={wordIndex} wordData={word} currentTime={t} />
                    ))}
                  </p>
                );
              })}
            </div>
          )
        )}
      </div>

      {/* Thanh điều khiển Player */}
      <div className="bg-black/30 backdrop-blur-sm p-4 rounded-lg mt-auto flex-shrink-0">
        <div className="flex items-center gap-4">
          <button onClick={handlePlayPause} className="btn btn-circle btn-primary">
            {player.isPlaying ? <FaPause size={20} /> : <FaPlay size={20} />}
          </button>
          <span className="text-sm font-mono">{formatTime(player.currentTime)}</span>
          <input
            type="range"
            min="0"
            max={Number.isFinite(player.duration) && player.duration > 0 ? player.duration : 0}
            value={Math.min(player.currentTime, Number.isFinite(player.duration) && player.duration > 0 ? player.duration : 0)}
            onChange={(e) => player.seek(parseFloat(e.target.value))}
            className="range range-primary flex-grow"
            disabled={!Number.isFinite(player.duration) || player.duration <= 0}
          />
          <span className="text-sm font-mono">{formatTime(player.duration)}</span>
          <div className="ml-auto flex items-center gap-2">
            {!isEditing ? (
              <button className="btn btn-sm" onClick={startEdit}>Sửa lời</button>
            ) : (
              <>
                <button className="btn btn-sm" onClick={cancelEdit} disabled={isSaving}>Huỷ</button>
                <button className="btn btn-sm btn-success" onClick={saveEdit} disabled={isSaving}>{isSaving ? 'Đang lưu...' : 'Lưu'}</button>
              </>
            )}
          </div>
        </div>

        {/* Slider chỉnh offset lời (±3s) */}
        <div className="mt-3 flex items-center gap-3">
          <span className="text-sm text-gray-300">Offset lời (s):</span>
          <input
            type="range"
            min={-3}
            max={3}
            step={0.05}
            value={lyricOffset}
            onChange={(e) => setLyricOffset(parseFloat(e.target.value))}
            className="w-56"
          />
          <span className="text-sm text-gray-300">{lyricOffset.toFixed(2)}s</span>
        </div>
      </div>
    </div>
  );
}
