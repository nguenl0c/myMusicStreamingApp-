import React, { useState, useEffect, useRef } from 'react';
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

export default function KaraokePlayer({ data, onBack }) {
  const { sessionId, instrumentalUrl } = data;
  const [lyrics, setLyrics] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const player = useKaraokePlayer();
  const activeLineRef = useRef(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        const lyricsData = await fetchKaraokeLyrics(sessionId);
        setLyrics(lyricsData);
        // Thêm tiền tố API_URL nếu cần
        const fullUrl = `http://localhost:5000${instrumentalUrl}`;
        player.load(fullUrl);
      } catch (err) {
        setError("Không thể tải dữ liệu karaoke.");
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
    return () => player.cleanup();
  }, [sessionId, instrumentalUrl]);

  useEffect(() => {
    if (activeLineRef.current) {
      activeLineRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [player.currentTime]);

  const formatTime = (seconds) => new Date(seconds * 1000).toISOString().substr(14, 5);

  return (
    <div className="p-6 text-white screen-container flex flex-col h-full">
      <button onClick={onBack} className="btn btn-ghost self-start mb-4">Quay lại</button>

      <div className="flex-grow flex items-center justify-center text-center overflow-hidden">
        {/* ... Phần hiển thị lời ... */}
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