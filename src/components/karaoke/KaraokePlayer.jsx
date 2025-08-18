import React, { useState, useEffect, useRef, useMemo } from 'react';
import { fetchKaraokeLyrics } from '../../services/karaokeApi';
import { useKaraokePlayer } from '../../hooks/useKaraokePlayer';
import { FaPlay, FaPause } from 'react-icons/fa';

const Word = ({ wordData, currentTime }) => {
  const { word, start, end } = wordData;
  const isPast = currentTime >= end;
  const isActive = currentTime >= start && currentTime < end;
  let progress = 0;
  if (isActive) {
    const duration = end - start;
    progress = duration > 0 ? ((currentTime - start) / duration) * 100 : 100;
  }
  return (
    <span className="relative inline-block mr-2 whitespace-nowrap">
      <span className="absolute inset-0 text-gray-400">{word}</span>
      <span className="absolute inset-0 text-yellow-300 overflow-hidden" style={{ width: isPast ? '100%' : `${progress}%` }}>{word}</span>
      <span className="opacity-0">{word}</span>
    </span>
  );
};

export default function KaraokePlayer({ data, onBack, autoStop = true }) {
  const { sessionId, instrumentalUrl } = data;
  const [lyrics, setLyrics] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const player = useKaraokePlayer();
  const activeLineRef = useRef(null);

  // Xác định dòng đang active dựa trên currentTime
  const activeIndex = useMemo(() => {
    const t = player.currentTime;
    if (!lyrics || lyrics.length === 0) return -1;
    // Binary search có thể tối ưu, tạm dùng linear do số dòng nhỏ
    for (let i = 0; i < lyrics.length; i++) {
      const seg = lyrics[i];
      if (t >= seg.start && t < seg.end) return i;
    }
    return -1;
  }, [player.currentTime, lyrics]);

  useEffect(() => {
    const loadData = async () => {
      try {
        const lyricsData = await fetchKaraokeLyrics(sessionId);
        setLyrics(lyricsData);
        // Thêm tiền tố API_URL nếu cần
        const fullUrl = `http://localhost:5000${instrumentalUrl}`;
        player.load(fullUrl);
      } catch (err) {
        console.error('Không thể tải dữ liệu karaoke:', err);
        setError("Không thể tải dữ liệu karaoke.");
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
    return () => {
      if (autoStop) player.cleanup();
    };
  // player có tham chiếu ổn định từ hook; phụ thuộc vào sessionId & instrumentalUrl
  }, [sessionId, instrumentalUrl, player, autoStop]);

  useEffect(() => {
    if (activeLineRef.current) {
      activeLineRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [activeIndex]);

  const formatTime = (seconds) => new Date(seconds * 1000).toISOString().substr(14, 5);

  return (
    <div className="p-6 text-white screen-container flex flex-col h-full">
      <button
        onClick={() => {
          if (autoStop) player.cleanup();
          onBack && onBack();
        }}
        className="btn btn-ghost self-start mb-4"
      >
        Quay lại
      </button>

      <div className="flex-grow overflow-y-auto px-2">
        {isLoading && (
          <div className="text-center text-gray-400 py-10">Đang tải lời...</div>
        )}
        {error && (
          <div className="text-center text-red-400 py-10">{error}</div>
        )}
        {!isLoading && !error && (
          <div className="max-w-3xl mx-auto space-y-3 py-4">
            {lyrics.map((line, idx) => {
              const isActive = idx === activeIndex;
              return (
                <div
                  key={`${line.start}-${idx}`}
                  ref={isActive ? activeLineRef : null}
                  className={`text-center transition-colors duration-200 ${
                    isActive ? 'text-white' : 'text-gray-400'
                  }`}
                >
                  {/* Hiển thị dạng từng từ với highlight */}
                  <div className="text-2xl md:text-3xl leading-relaxed">
                    {Array.isArray(line.words) && line.words.length > 0 ? (
                      line.words.map((w, wi) => (
                        <Word key={wi} wordData={w} currentTime={player.currentTime} />
                      ))
                    ) : (
                      <span>{line.text}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Thanh điều khiển Player */}
      <div className="bg-black/30 backdrop-blur-sm p-4 rounded-lg mt-4">
        <div className="flex items-center gap-4">
          <button onClick={() => player.isPlaying ? player.pause() : player.play()} className="btn btn-circle btn-primary">
            {player.isPlaying ? <FaPause size={20} /> : <FaPlay size={20} />}
          </button>
          <span className="text-sm">{formatTime(player.currentTime)}</span>
          <input
            type="range"
            min="0"
            max={player.duration || 0}
            value={player.currentTime}
            step={0.01}
            onChange={(e) => player.seek(parseFloat(e.target.value))}
            className="range range-primary flex-grow"
          />
          <span className="text-sm">{formatTime(player.duration)}</span>
        </div>
      </div>
    </div>
  );
}

// Dán lại component Word ở đây để file tự chứa
const WordComponent = ({ wordData, currentTime }) => {
  const { word, start, end } = wordData;
  const isPast = currentTime >= end;
  const isActive = currentTime >= start && currentTime < end;
  let progress = 0;
  if (isActive) {
    const duration = end - start;
    progress = duration > 0 ? ((currentTime - start) / duration) * 100 : 100;
  }
  return (
    <span className="relative inline-block mr-2 whitespace-nowrap">
      <span className="absolute inset-0 text-gray-400">{word}</span>
      <span
        className="absolute inset-0 text-yellow-300 overflow-hidden"
        style={{ width: isPast ? '100%' : `${progress}%` }}
      >
        {word}
      </span>
      <span className="opacity-0">{word}</span>
    </span>
  );
};
// Đổi tên để tránh xung đột
KaraokePlayer.Word = WordComponent;