// src/hooks/useKaraokePlayer.js
import { useCallback, useEffect, useRef, useState } from 'react';

export function useKaraokePlayer() {
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // Tạo audio khi cần
  const ensureAudio = useCallback(() => {
    if (!audioRef.current) {
      const audio = new Audio();
      audio.crossOrigin = 'anonymous';
      audioRef.current = audio;
    }
    return audioRef.current;
  }, []);

  const load = useCallback((url) => {
    const audio = ensureAudio();
    // Prefix URL khi là đường dẫn tương đối từ backend
    const fullUrl = /^https?:\/\//i.test(url) ? url : `http://localhost:5000${url}`;
    audio.src = fullUrl;
    audio.load();
  }, [ensureAudio]);

  const play = useCallback(async () => {
    const audio = ensureAudio();
    try {
      await audio.play();
      setIsPlaying(true);
    } catch (e) {
      console.error('Audio play error:', e);
    }
  }, [ensureAudio]);

  const pause = useCallback(() => {
    const audio = ensureAudio();
    audio.pause();
    setIsPlaying(false);
  }, [ensureAudio]);

  const seek = useCallback((t) => {
    const audio = ensureAudio();
    audio.currentTime = t;
    setCurrentTime(t);
  }, [ensureAudio]);

  const cleanup = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.src = '';
      audioRef.current = null;
    }
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
  }, []);

  useEffect(() => {
    const audio = ensureAudio();
    const onTime = () => setCurrentTime(audio.currentTime || 0);
    const onLoaded = () => setDuration(audio.duration || 0);
    const onEnd = () => setIsPlaying(false);
    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('loadedmetadata', onLoaded);
    audio.addEventListener('ended', onEnd);
    return () => {
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('loadedmetadata', onLoaded);
      audio.removeEventListener('ended', onEnd);
    };
  }, [ensureAudio]);

  return { isPlaying, currentTime, duration, load, play, pause, seek, cleanup };
}
