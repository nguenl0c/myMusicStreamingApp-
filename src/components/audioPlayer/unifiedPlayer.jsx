// src/components/audioPlayer/unifiedPlayer.improved.jsx
import React, { useState, useEffect, useRef, useCallback } from "react";
import SpotifyWebPlayer from "react-spotify-web-playback";
import { getValidToken } from "../../spotify";
import Controls from "./controls";
import unifiedPlaylistManager from "../../services/unifiedPlaylistManager";
import { pauseSpotifyTrack, seekSpotifyTrack } from "./spotifyHelper";
import axios from 'axios';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// Enum cho nguồn phát nhạc
const PLAYER_SOURCE = {
  NONE: "none",
  SPOTIFY: "spotify",
  LOCAL: "local",
};

export default function UnifiedPlayer({
  playlistId,
  initialTrackIndex = 0,
  onTrackChange,
}) {  // State chung
  const [tracks, setTracks] = useState([]);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(initialTrackIndex);
  const [currentTrack, setCurrentTrack] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeSource, setActiveSource] = useState(PLAYER_SOURCE.NONE);
  const [duration, setDuration] = useState(0);
  const [trackProgress, setTrackProgress] = useState(0);
  const [token, setToken] = useState("");
  const [error, setError] = useState(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [lastValidProgress, setLastValidProgress] = useState(0); // Lưu progress hợp lệ cuối cùng
  
  // Volume control states
  const [volume, setVolume] = useState(0.7); // Default volume 70%
  const [isMuted, setIsMuted] = useState(false);
  const [previousVolume, setPreviousVolume] = useState(0.7); // Store volume before muting
  
  // Shuffle and repeat states
  const [isShuffled, setIsShuffled] = useState(false);
  const [repeatMode, setRepeatMode] = useState('none'); // 'none', 'all', 'one'

  // Refs
  const audioRef = useRef(new Audio());
  const intervalRef = useRef(null);

  // Lấy token
  useEffect(() => {
    const fetchToken = async () => {
      const validToken = await getValidToken();
      setToken(validToken);
    };

    fetchToken();
  }, []);

  // Apply volume to audio element
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  // Lấy danh sách bài hát từ playlist
  useEffect(() => {
    const loadPlaylistTracks = async () => {
      if (!playlistId) return;

      try {
        const playableTracks =
          await unifiedPlaylistManager.getPlayableTracksForPlaylist(playlistId);
        setTracks(playableTracks);

        if (playableTracks.length > 0) {
          const initialIndex = Math.min(
            initialTrackIndex,
            playableTracks.length - 1
          );
          setCurrentTrackIndex(initialIndex);
        }
      } catch (error) {
        console.error("Error loading playlist tracks:", error);
        setError("Không thể tải danh sách bài hát");
      }
    };

    loadPlaylistTracks();
  }, [playlistId, initialTrackIndex]);
  // Hàm dừng tất cả players để tránh xung đột (không dùng useCallback để tránh dependency loop)
  const stopAllPlayers = async () => {
    console.log('Stopping all players...');
    
    // Dừng local audio
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    
    // Clear interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    
    // Dừng Spotify (chỉ khi có token)
    if (token) {
      try {
        await pauseSpotifyTrack(token);
        console.log('Spotify playback paused');
      } catch (error) {
        console.error("Error pausing Spotify:", error);
      }
    }
  };  // Cập nhật currentTrack khi currentTrackIndex thay đổi
  useEffect(() => {
    if (
      tracks.length === 0 ||
      currentTrackIndex < 0 ||
      currentTrackIndex >= tracks.length ||
      isTransitioning
    )
      return;

    const switchTrack = async () => {
      setIsTransitioning(true);
      setError(null);
      
      try {
        // Dừng tất cả players trước khi chuyển track
        await stopAllPlayers();

        const track = tracks[currentTrackIndex];
        console.log('Switching to track:', track.name, 'Type:', track.type);
        
        setCurrentTrack(track);
        setActiveSource(
          track.type === "spotify" ? PLAYER_SOURCE.SPOTIFY : PLAYER_SOURCE.LOCAL
        );        if (track.type === "local") {
          // Chuẩn bị audio element
          if (audioRef.current) {
            audioRef.current.src = track.url;
            audioRef.current.load();
            
            // Setup event listeners
            audioRef.current.onloadedmetadata = () => {
              setDuration(audioRef.current.duration);
            };
              // Handle track end directly
            audioRef.current.onended = () => {
              console.log('Local track ended');
              setCurrentTrackIndex(prev => {
                if (prev < tracks.length - 1) {
                  return prev + 1;
                } else {
                  setIsPlaying(false);
                  return 0;
                }
              });
            };
          }
        } else if (track.type === "spotify") {
          // For Spotify tracks, set duration from track metadata if available
          if (track.duration) {
            setDuration(track.duration);
          }
        }

        // Reset progress
        setTrackProgress(0);

        if (onTrackChange) {
          onTrackChange(track, currentTrackIndex);
        }
      } catch (error) {
        console.error('Error switching track:', error);
        setError('Không thể chuyển bài hát');
      } finally {
        setIsTransitioning(false);
      }
    };
    
    switchTrack();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTrackIndex, tracks.length]); // Chỉ giữ lại dependencies quan trọng nhất  // Xử lý khi isPlaying thay đổi
  useEffect(() => {
    if (isTransitioning || !currentTrack) return;

    const handlePlaybackChange = async () => {
      if (activeSource === PLAYER_SOURCE.LOCAL) {
        if (isPlaying) {
          try {
            await audioRef.current.play();
            console.log('Local track playing');

            // Interval để cập nhật tiến trình cho local tracks
            intervalRef.current = setInterval(() => {
              if (audioRef.current && !audioRef.current.paused) {
                setTrackProgress(audioRef.current.currentTime);
              }
            }, 100);
          } catch (error) {
            console.error("Error playing local audio:", error);
            setIsPlaying(false);
            setError('Không thể phát nhạc local');
          }
        } else {
          audioRef.current.pause();
          console.log('Local track paused');

          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
        }      } else if (activeSource === PLAYER_SOURCE.SPOTIFY) {
        // Clear any existing interval for Spotify
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        
        // Thiết lập interval để cập nhật progress cho Spotify (giống player chính)
        if (isPlaying && token) {
          console.log('Setting up Spotify progress tracking');
          intervalRef.current = setInterval(async () => {
            try {
              const response = await axios.get(
                "https://api.spotify.com/v1/me/player/currently-playing",
                {
                  headers: {
                    Authorization: `Bearer ${token}`,
                  },
                }
              );

              if (response.data && response.data.item) {
                const progress = response.data.progress_ms / 1000;
                const totalDuration = response.data.item.duration_ms / 1000;
                setTrackProgress(progress);
                setDuration(totalDuration);

                // Kiểm tra nếu bài hát gần kết thúc
                if (totalDuration - progress <= 1) {
                  setCurrentTrackIndex(prev => {
                    if (prev < tracks.length - 1) {
                      return prev + 1;
                    } else {
                      setIsPlaying(false);
                      return 0;
                    }
                  });
                }
              }
            } catch (error) {
              console.error("Error fetching Spotify playback state:", error);
            }
          }, 1000);
        }
        
        console.log(`Spotify playback ${isPlaying ? 'playing' : 'paused'}`);
      }
    };

    handlePlaybackChange();
  }, [isPlaying, activeSource, currentTrack, isTransitioning, token, tracks.length]);

  // Cleanup
  useEffect(() => {
    const audio = audioRef.current;
    return () => {
      if (audio) {
        audio.pause();
        audio.src = "";
      }

      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);  // Xử lý khi người dùng thay đổi vị trí
  const handleProgressChange = useCallback((value) => {
    setTrackProgress(value);

    if (activeSource === PLAYER_SOURCE.LOCAL && audioRef.current) {
      audioRef.current.currentTime = value;
    } else if (activeSource === PLAYER_SOURCE.SPOTIFY && token) {
      // Gọi Spotify API để seek (fire-and-forget)
      seekSpotifyTrack(token, value * 1000).catch((error) => {
        console.error("Error seeking Spotify track:", error);
      });
    }
  }, [activeSource, token]);  // Handle skip next - giữ nguyên trạng thái playing
  const handleSkipNext = async () => {
    if (currentTrackIndex < tracks.length - 1) {
      const wasPlaying = isPlaying;
      await stopAllPlayers();
      setCurrentTrackIndex(prev => prev + 1);
      // Giữ nguyên trạng thái playing để bài tiếp theo tự động phát
      if (wasPlaying) {
        // Đặt delay nhỏ để track mới được load trước
        setTimeout(() => setIsPlaying(true), 100);
      }
    }
  };

  // Handle skip previous - giữ nguyên trạng thái playing
  const handleSkipPrevious = async () => {
    if (currentTrackIndex > 0) {
      const wasPlaying = isPlaying;
      await stopAllPlayers();
      setCurrentTrackIndex(prev => prev - 1);
      // Giữ nguyên trạng thái playing để bài tiếp theo tự động phát
      if (wasPlaying) {
        setTimeout(() => setIsPlaying(true), 100);
      }
    }
  };

  // Volume control handlers
  const handleVolumeChange = async (newVolume) => {
    const clampedVolume = Math.max(0, Math.min(1, newVolume));
    setVolume(clampedVolume);
    if (clampedVolume > 0 && isMuted) {
      setIsMuted(false);
    }
    
    // Áp dụng volume cho Spotify nếu đang phát Spotify track
    if (activeSource === PLAYER_SOURCE.SPOTIFY && token) {
      try {
        await axios.put(
          "https://api.spotify.com/v1/me/player/volume",
          null,
          {
            params: {
              volume_percent: Math.round(clampedVolume * 100),
            },
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );
      } catch (error) {
        console.error("Error setting Spotify volume:", error);
      }
    }
  };

  const handleMuteToggle = async () => {
    if (isMuted) {
      // Unmute: restore previous volume
      setIsMuted(false);
      setVolume(previousVolume);
      
      // Áp dụng cho Spotify
      if (activeSource === PLAYER_SOURCE.SPOTIFY && token) {
        try {
          await axios.put(
            "https://api.spotify.com/v1/me/player/volume",
            null,
            {
              params: {
                volume_percent: Math.round(previousVolume * 100),
              },
              headers: {
                Authorization: `Bearer ${token}`,
              },
            }
          );
        } catch (error) {
          console.error("Error unmuting Spotify:", error);
        }
      }
    } else {
      // Mute: save current volume and set to 0
      setPreviousVolume(volume);
      setIsMuted(true);
      
      // Áp dụng cho Spotify
      if (activeSource === PLAYER_SOURCE.SPOTIFY && token) {
        try {
          await axios.put(
            "https://api.spotify.com/v1/me/player/volume",
            null,
            {
              params: {
                volume_percent: 0,
              },
              headers: {
                Authorization: `Bearer ${token}`,
              },
            }
          );
        } catch (error) {
          console.error("Error muting Spotify:", error);
        }
      }
    }
  };

  // Shuffle and repeat handlers
  const handleShuffleToggle = () => {
    setIsShuffled(!isShuffled);
    // TODO: Implement shuffle logic
  };

  const handleRepeatToggle = () => {
    const modes = ['none', 'all', 'one'];
    const currentIndex = modes.indexOf(repeatMode);
    const nextIndex = (currentIndex + 1) % modes.length;
    setRepeatMode(modes[nextIndex]);
  };

  // DnD-kit setup
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    })
  );

  // Handle drag end
  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = tracks.findIndex((t) => `${t.type}-${t.id}` === active.id);
    const newIndex = tracks.findIndex((t) => `${t.type}-${t.id}` === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const newTracks = arrayMove(tracks, oldIndex, newIndex);
    setTracks(newTracks);
    // Nếu đang phát bài bị kéo, cập nhật lại index
    if (currentTrackIndex === oldIndex) {
      setCurrentTrackIndex(newIndex);
    } else if (oldIndex < currentTrackIndex && newIndex >= currentTrackIndex) {
      setCurrentTrackIndex(currentTrackIndex - 1);
    } else if (oldIndex > currentTrackIndex && newIndex <= currentTrackIndex) {
      setCurrentTrackIndex(currentTrackIndex + 1);
    }
  };

  return (
    <div className="unified-player">
      {error && (
        <div className="bg-red-500 text-white p-3 rounded-lg mb-4">
          {error}
        </div>
      )}

      {/* Player Controls */}
      <div className="player-controls">
        <Controls
          isPlaying={isPlaying && !isTransitioning}
          onPlayPause={async () => {
            if (isTransitioning) return;
            
            if (isPlaying) {
              await stopAllPlayers();
              setIsPlaying(false);
            } else {
              if (currentTrack) {
                setIsPlaying(true);
              }
            }
          }}
          onSkipNext={handleSkipNext}
          onSkipPrevious={handleSkipPrevious}
          onProgressChange={async (newTime) => {
            if (isTransitioning) return;
            
            if (activeSource === PLAYER_SOURCE.LOCAL && audioRef.current) {
              audioRef.current.currentTime = newTime;
              setTrackProgress(newTime);
            } else if (activeSource === PLAYER_SOURCE.SPOTIFY && token) {
              try {
                await seekSpotifyTrack(token, newTime * 1000);
                setTrackProgress(newTime);
              } catch (error) {
                console.error("Error seeking Spotify track:", error);
              }
            }
          }}
          trackProgress={trackProgress}
          duration={duration}
          volume={volume}
          onVolumeChange={handleVolumeChange}
          isMuted={isMuted}
          onMuteToggle={handleMuteToggle}
          isShuffled={isShuffled}
          onShuffleToggle={handleShuffleToggle}
          repeatMode={repeatMode}
          onRepeatToggle={handleRepeatToggle}
        />
      </div>

      {/* Spotify Web Player (ẩn) */}
      {token && (
        <div style={{ display: "none" }}>
          <SpotifyWebPlayer
            token={token}
            uris={
              activeSource === PLAYER_SOURCE.SPOTIFY && currentTrack && !isTransitioning
                ? [currentTrack.uri]
                : []
            }
            play={activeSource === PLAYER_SOURCE.SPOTIFY && isPlaying && !isTransitioning}
            volume={Math.round((isMuted ? 0 : volume) * 100)}            callback={(state) => {
              if (activeSource === PLAYER_SOURCE.SPOTIFY && !isTransitioning && state) {
                console.log('Spotify Web Player callback - state:', state.isPlaying, state.position, state.duration);
                
                // Cập nhật trạng thái phát (giống player chính)
                setIsPlaying(!state.paused);
                
                // Cập nhật tiến trình và thời lượng (giống player chính)
                if (state.position !== undefined) {
                  setTrackProgress(state.position / 1000);
                }
                if (state.duration !== undefined) {
                  setDuration(state.duration / 1000);
                  
                  // Kiểm tra nếu bài hát đã kết thúc (giống player chính)
                  if (state.position >= state.duration - 500) {
                    console.log('Spotify track ended');
                    setCurrentTrackIndex(prev => {
                      if (prev < tracks.length - 1) {
                        return prev + 1;
                      } else {
                        setIsPlaying(false);
                        return 0;
                      }
                    });
                  }
                }
              }
            }}
            getOAuthToken={(cb) => {
              getValidToken().then((validToken) => {
                if (validToken) cb(validToken);
              });
            }}
            name="Unified Player"
          />
        </div>
      )}
    </div>
  );
}

// Hàm format thời gian (giây -> mm:ss)
function formatTime(seconds) {
  if (!seconds || isNaN(seconds)) return "0:00";

  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
}

// Sortable item component for each track
function SortableTrack({
  track,
  index,
  currentTrackIndex,
  isPlaying,
  onClick,
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `${track.type}-${track.id}` });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    cursor: "grab",
    background: isDragging
      ? "#222"
      : currentTrackIndex === index
      ? "#374151"
      : "",
    borderRadius: currentTrackIndex === index ? "0.5rem" : "",
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`p-2 cursor-pointer flex items-center ${
        currentTrackIndex === index
          ? "bg-gray-700 rounded-lg"
          : "hover:bg-gray-800"
      }`}
      onClick={onClick}
    >
      <div className="mr-3 w-6 text-center">
        {currentTrackIndex === index && isPlaying ? (
          <span className="text-[#1DB954]">▶</span>
        ) : (
          <span className="text-gray-400">{index + 1}</span>
        )}
      </div>
      <div className="flex-1">
        <p className="text-sm font-medium truncate">{track.name}</p>
        <p className="text-xs text-gray-500 truncate">{track.artist}</p>
      </div>
      <div className="flex items-center">
        <span
          className={`px-1.5 py-0.5 text-xs rounded mr-2 ${
            track.type === "spotify"
              ? "bg-green-900/50 text-green-100"
              : "bg-blue-900/50 text-blue-100"
          }`}
        >
          {track.type === "spotify" ? "S" : "L"}
        </span>
        <span className="text-xs text-gray-500">
          {formatTime(track.duration)}
        </span>
      </div>
    </div>
  );
}
