import React, { useState, useEffect, useRef } from 'react';
import { fetchKaraokeLyrics } from '../../services/karaokeApi';
import { useKaraokePlayer } from '../../hooks/useKaraokePlayer';
import { FaPlay, FaPause } from 'react-icons/fa';

// Component Word để render từng từ với hiệu ứng chạy chữ (không đổi)
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


export default function KaraokePlayer({ data, onBack }) {
  const { sessionId, instrumentalUrl, songName } = data;
  const [lyrics, setLyrics] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const player = useKaraokePlayer();
  const activeLineRef = useRef(null);

  // useEffect để tải dữ liệu (nhạc và lời) khi component được mount
  useEffect(() => {
    const loadData = async () => {
      try {
        // Tải lời bài hát
        const lyricsData = await fetchKaraokeLyrics(sessionId);
        setLyrics(lyricsData);

        // Tải nhạc nền
        const fullUrl = `http://localhost:5000${instrumentalUrl}`;
        player.load(fullUrl);

      } catch (err) {
        setError("Không thể tải dữ liệu karaoke.");
      } finally {
        setIsLoading(false);
      }
    };

    loadData();

    // Hàm cleanup sẽ được gọi khi component unmount
    return () => player.cleanup();
  }, [sessionId, instrumentalUrl]); // Chỉ chạy lại khi session thay đổi

  // useEffect để tự động cuộn theo lời bài hát
  useEffect(() => {
    if (activeLineRef.current) {
      activeLineRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [player.currentTime]); // Theo dõi sự thay đổi của currentTime

  // Hàm định dạng thời gian cho đẹp hơn
  const formatTime = (seconds) => {
    if (isNaN(seconds) || seconds < 0) return "00:00";
    return new Date(seconds * 1000).toISOString().substr(14, 5);
  }

  return (
    <div className="p-6 text-white screen-container flex flex-col h-full max-h-screen">
      {/* Header */}
      <div className="flex justify-between items-center flex-shrink-0">
        <button onClick={onBack} className="btn btn-ghost">Quay lại</button>
        <h2 className="text-xl font-bold truncate text-center">{songName || 'Karaoke'}</h2>
        <div className="w-24"></div> {/* Spacer để căn giữa tiêu đề */}
      </div>

      {/* Khu vực hiển thị lời */}
      <div className="flex-grow flex items-center justify-center text-center overflow-hidden my-4">
        {isLoading ? <p>Đang tải...</p> : error ? <p className="text-red-400">{error}</p> : (
          <div className="h-full w-full overflow-y-auto p-4 flex flex-col justify-center">
            {lyrics.map((line, index) => {
              const isActiveLine = player.currentTime >= line.start && player.currentTime <= line.end;
              return (
                <p
                  key={index}
                  ref={isActiveLine ? activeLineRef : null}
                  className={`text-3xl md:text-5xl font-bold transition-all duration-300 p-2 transform ${isActiveLine ? 'scale-110' : 'text-gray-300 scale-90'}`}
                >
                  {line.words.map((word, wordIndex) => (
                    <Word key={wordIndex} wordData={word} currentTime={player.currentTime} />
                  ))}
                </p>
              );
            })}
          </div>
        )}
      </div>

      {/* Thanh điều khiển Player */}
      <div className="bg-black/30 backdrop-blur-sm p-4 rounded-lg mt-auto flex-shrink-0">
        <div className="flex items-center gap-4">
          <button onClick={() => player.isPlaying ? player.pause() : player.play()} className="btn btn-circle btn-primary">
            {player.isPlaying ? <FaPause size={20} /> : <FaPlay size={20} />}
          </button>
          <span className="text-sm font-mono">{formatTime(player.currentTime)}</span>
          <input
            type="range"
            min="0"
            max={player.duration || 0}
            value={player.currentTime}
            onChange={(e) => player.seek(parseFloat(e.target.value))}
            className="range range-primary flex-grow"
          />
          <span className="text-sm font-mono">{formatTime(player.duration)}</span>
        </div>
      </div>
    </div>
  );
}
