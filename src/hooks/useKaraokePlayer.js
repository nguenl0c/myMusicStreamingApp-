import { useState, useEffect, useRef, useCallback } from 'react';

export const useKaraokePlayer = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [error, setError] = useState(null);

  const audioRef = useRef(new Audio());
  const animationFrameId = useRef(null); // Ref để lưu ID của animation frame

  // Vòng lặp cập nhật thời gian siêu mượt bằng requestAnimationFrame
  const animate = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      setCurrentTime(audio.currentTime);
      animationFrameId.current = requestAnimationFrame(animate);
    }
  }, []);

  const startAnimation = useCallback(() => {
    if (animationFrameId.current) {
      cancelAnimationFrame(animationFrameId.current);
    }
    animationFrameId.current = requestAnimationFrame(animate);
  }, [animate]);

  const stopAnimation = useCallback(() => {
    if (animationFrameId.current) {
      cancelAnimationFrame(animationFrameId.current);
    }
  }, []);


  const cleanup = useCallback(() => {
    stopAnimation();
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      // Gỡ bỏ tất cả các event listener cũ để tránh memory leak
      audio.replaceWith(audio.cloneNode(true));
      audioRef.current = new Audio();
    }
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
  }, [stopAnimation]);

  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  const load = useCallback((url) => {
    cleanup();
    const audio = audioRef.current;
    audio.src = url;
    audio.preload = 'auto';
    audio.load();

    const onLoadedMetadata = () => setDuration(audio.duration || 0);
    const onPlay = () => {
      setIsPlaying(true);
      startAnimation();
    };
    const onPause = () => {
      setIsPlaying(false);
      stopAnimation();
    };
    const onEnded = () => {
      setIsPlaying(false);
      stopAnimation();
      setCurrentTime(0); // Reset về đầu khi kết thúc
    };
    const onError = () => setError("Lỗi khi tải file nhạc.");

    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);

  }, [cleanup, startAnimation, stopAnimation]);

  const play = () => {
    audioRef.current.play().catch(e => setError("Không thể phát nhạc."));
  };

  const pause = () => {
    audioRef.current.pause();
  };

  const seek = (time) => {
    if (isFinite(time)) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
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
