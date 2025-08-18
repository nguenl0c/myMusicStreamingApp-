import { useState, useEffect, useRef, useCallback } from 'react';

// Dựa trên hook useLocalPlayer của bạn, nhưng được đơn giản hóa để
// làm việc với URL trực tiếp thay vì ID từ database.
export const useKaraokePlayer = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [error, setError] = useState(null);

  const audioRef = useRef(new Audio());

  const cleanup = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.src = ''; // Giải phóng file khỏi bộ nhớ
    }
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
  }, []);

  useEffect(() => {
    // Đảm bảo cleanup được gọi khi component bị unmount
    return cleanup;
  }, [cleanup]);

  const load = useCallback((url) => {
    cleanup(); // Dọn dẹp trước khi tải track mới
    const audio = audioRef.current;

    audio.src = url;
    audio.preload = 'auto';
    audio.load();

    const onLoadedMetadata = () => setDuration(audio.duration || 0);
    const onDurationChange = () => setDuration(audio.duration || 0);
    const onTimeUpdate = () => setCurrentTime(audio.currentTime || 0);
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnded = () => setIsPlaying(false);
    const onError = () => setError("Lỗi khi tải file nhạc.");

    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('durationchange', onDurationChange);
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);

    // Tự động phát sau khi có đủ dữ liệu
    const onCanPlay = () => {
      audio.play().catch(e => console.error("Autoplay failed:", e));
      setIsPlaying(true);
    };
    audio.addEventListener('canplay', onCanPlay);

    return () => {
      // Cleanup listeners
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('durationchange', onDurationChange);
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
      audio.removeEventListener('canplay', onCanPlay);
    };
  }, [cleanup]);

  const play = () => {
    audioRef.current.play();
    setIsPlaying(true);
  };

  const pause = () => {
    audioRef.current.pause();
    setIsPlaying(false);
  };

  const seek = (time) => {
    audioRef.current.currentTime = time;
    setCurrentTime(time);
  };

  return {
    isPlaying,
    duration,
    currentTime,
    error,
    load,
    play,
    pause,
    seek,
    cleanup,
  };
};