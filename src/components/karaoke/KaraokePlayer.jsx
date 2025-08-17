import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useKaraokePlayer } from '../../hooks/useKaraokePlayer';
import { fetchLyrics } from '../../services/mixerApi';

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

export default function KaraokePlayer({ sessionId, instrumentalUrl, onClose }) {
  const player = useKaraokePlayer();
  const [lyrics, setLyrics] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const activeLineRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await fetchLyrics(sessionId);
        if (!cancelled) setLyrics(Array.isArray(data) ? data : []);
        // Load instrumental và tự phát
        player.load(instrumentalUrl);
        player.play();
      } catch (e) {
        if (!cancelled) setError('Không thể tải lyrics hoặc nhạc nền');
        console.error('[KaraokePlayer] load error:', e);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
      player.cleanup();
    };
  }, [sessionId, instrumentalUrl, player]);

  useEffect(() => {
    if (activeLineRef.current) {
      activeLineRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [player.currentTime]);

  const currentTime = player.currentTime;
  const activeLineIndex = useMemo(() => {
    return lyrics.findIndex(line => currentTime >= line.start && currentTime <= line.end);
  }, [lyrics, currentTime]);

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="w-11/12 max-w-4xl h-5/6 bg-gray-800 text-white rounded-2xl shadow-2xl flex flex-col p-6">
        <div className="flex justify-between items-center mb-4 flex-shrink-0">
          <h2 className="text-2xl font-bold truncate">Karaoke Session</h2>
          <button onClick={onClose} className="px-4 py-2 bg-red-600 rounded-lg hover:bg-red-700">Đóng</button>
        </div>
        <div className="flex items-center gap-3 mb-3">
          <button onClick={player.play} className="px-3 py-1 bg-blue-600 rounded hover:bg-blue-700">Play</button>
          <button onClick={player.pause} className="px-3 py-1 bg-yellow-600 rounded hover:bg-yellow-700">Pause</button>
          <div className="text-sm opacity-80">{Math.floor(currentTime)} / {Math.floor(player.duration)}s</div>
        </div>
        <div className="flex-grow min-h-0">
          {isLoading && <p className="flex items-center justify-center h-full">Đang tải nhạc và lời...</p>}
          {error && <p className="flex items-center justify-center h-full text-red-400 text-center">{error}</p>}
          {!isLoading && !error && lyrics.length > 0 && (
            <div className="h-full overflow-y-auto text-center p-4 md:p-8 scrollbar-thin scrollbar-thumb-gray-600 flex flex-col justify-center">
              {lyrics.map((line, index) => (
                <p key={index} ref={activeLineIndex === index ? activeLineRef : null}
                   className={`text-2xl md:text-4xl font-bold transition-all duration-300 p-2 transform ${activeLineIndex === index ? 'scale-110' : 'text-gray-300 scale-90'}`}>
                  {line.words?.map((word, i) => (
                    <Word key={i} wordData={word} currentTime={currentTime} />
                  ))}
                </p>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
