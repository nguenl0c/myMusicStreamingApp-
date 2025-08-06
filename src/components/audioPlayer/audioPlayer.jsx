import React, { useState, useEffect, useRef, useCallback } from 'react';
import SpotifyWebPlayer from 'react-spotify-web-playback';
import { getAccessToken} from '../../spotify';
import ProgressCircle from './progressCircle';
import Controls from './controls';
// import DeviceSelector from './deviceSelector';
import axios from 'axios';

export default function AudioPlayer({
  currentTrack,
  currentIndex,
  setCurrentIndex,
  tracks,
  isPremium = false,
  previewUrl = null,
  isPlaying,
  setIsPlaying,
  userPaused,
  setUserPaused
}) {
  const [token, setToken] = useState("");
  const [trackProgress, setTrackProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState(null);
  
  // Volume control states
  const [volume, setVolume] = useState(0.7);
  const [isMuted, setIsMuted] = useState(false);
  const [previousVolume, setPreviousVolume] = useState(0.7);

  // Trạng thái quản lý thiết bị
  const [activeDevice] = useState(null);
  // const [showDeviceSelector, setShowDeviceSelector] = useState(false);

  const audioRef = useRef(null);
  // const intervalRef = useRef();

  // Apply volume to audio element
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  // Hàm phát nhạc trên thiết bị Spotify
  const playOnDevice = useCallback(async () => {
    if (!activeDevice) {
      console.error("Không có thiết bị nào đang hoạt động");
      setError(
        "Không tìm thấy thiết bị phát nhạc. Vui lòng mở ứng dụng Spotify hoặc tải lại trang."
      );
      return;
    }

    try {
      await axios.put(
        `https://api.spotify.com/v1/me/player/play?device_id=${activeDevice}`,
        {
          uris: getTrackUris(),
          offset: { position: currentIndex },
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );
    } catch (error) {
      console.error("Lỗi khi phát nhạc:", error);

      // Thử phương án khác (transfer playback)
      try {
        await axios.put(
          "https://api.spotify.com/v1/me/player",
          {
            device_ids: [activeDevice],
            play: true,
          },
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          }
        );
      } catch (err) {
        console.error("Không thể chuyển phát nhạc đến thiết bị:", err);
        setError(
          "Không thể phát nhạc. Vui lòng kiểm tra tài khoản Spotify của bạn."
        );
      }
    }
  }, [activeDevice, token, currentIndex]);

  // Hàm tạm dừng nhạc trên thiết bị Spotify
  const pauseOnDevice = useCallback(async () => {
    try {
      await axios.put(
        "https://api.spotify.com/v1/me/player/pause",
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );
    } catch (error) {
      console.error("Lỗi khi tạm dừng nhạc:", error);
      setError("Không thể tạm dừng nhạc. Vui lòng thử lại.");
    }
  }, [token]);

  // Xử lý khi bài hát kết thúc
  const handleTrackEnd = useCallback(() => {
    if (currentIndex < tracks.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      setCurrentIndex(0);
    }
  }, [currentIndex, tracks.length, setCurrentIndex]);

  // Lấy token từ localStorage
  useEffect(() => {
    const accessToken = getAccessToken();
    setToken(accessToken);
  }, []);

  // Xử lý phát nhạc khi currentTrack thay đổi
  useEffect(() => {
    if (!currentTrack) return;

    if (isPremium) {
      if (activeDevice) {
        if (isPlaying && !userPaused) {
          playOnDevice().catch((err) => {
            console.error("Lỗi khi phát nhạc:", err);
            setTimeout(() => {
              if (isPlaying && !userPaused) playOnDevice();
            }, 2000);
          });
        }
      }
    } else if (previewUrl) {
      if (isPlaying && !userPaused) {
        playPreview();
      }
    }
  }, [
    currentTrack,
    isPremium,
    previewUrl,
    activeDevice,
    isPlaying,
    userPaused,
    playOnDevice,
  ]);

  // Xử lý play/pause khi isPlaying thay đổi
  useEffect(() => {
    // Nếu đã tạm dừng bởi người dùng, thì useEffect này sẽ không kích hoạt phát lại
    console.log("isPlaying changed:", isPlaying, "userPaused:", userPaused);

    if (isPremium) {
      if (activeDevice) {
        if (isPlaying && !userPaused) {
          console.log("Playing music on device");
          playOnDevice();
        } else if (!isPlaying) {
          console.log("Pausing music on device");
          pauseOnDevice();
        }
      }
    } else if (previewUrl) {
      if (isPlaying && !userPaused) {
        console.log("Playing preview");
        playPreview();
      } else if (!isPlaying) {
        console.log("Pausing preview");
        pausePreview();
      }
    }
  }, [
    isPlaying,
    userPaused,
    previewUrl,
    isPremium,
    activeDevice,
    playOnDevice,
    pauseOnDevice,
  ]);

  // Cập nhật audio element để theo dõi tiến trình phát
  useEffect(() => {
    let progressUpdateInterval;

    if (isPremium && isPlaying && !userPaused) {
      progressUpdateInterval = setInterval(async () => {
        try {
          const response = await axios.get(
            "https://api.spotify.com/v1/me/player/currently-playing",
            {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            }
          );

          if (response.data) {
            const progress = response.data.progress_ms / 1000;
            const totalDuration = response.data.item.duration_ms / 1000;
            setTrackProgress(progress);
            setDuration(totalDuration);

            // Kiểm tra nếu bài hát gần kết thúc (còn 1 giây hoặc ít hơn)
            if (totalDuration - progress <= 1) {
              handleTrackEnd();
            }
          }
        } catch {
          // Xử lý lỗi
        }
      }, 1000);
    } else if (audioRef.current && isPlaying && !userPaused) {
      progressUpdateInterval = setInterval(() => {
        const current = audioRef.current.currentTime;
        const total = audioRef.current.duration || 30;
        setTrackProgress(current);

        // Kiểm tra nếu bài hát gần kết thúc (còn 0.5 giây hoặc ít hơn)
        if (total - current <= 0.5) {
          handleTrackEnd();
        }
      }, 100);
    }

    return () => {
      if (progressUpdateInterval) {
        clearInterval(progressUpdateInterval);
      }
    };
  }, [isPremium, isPlaying, token, userPaused, handleTrackEnd]);

  // Lưu trữ vị trí phát cuối cùng khi tạm dừng
  const [savedPosition, setSavedPosition] = useState(0);

  useEffect(() => {
    // Lưu vị trí hiện tại khi người dùng tạm dừng
    if (userPaused && audioRef.current) {
      setSavedPosition(audioRef.current.currentTime);
      console.log("Saved position:", audioRef.current.currentTime);
    }
  }, [userPaused]);

  useEffect(() => {
    // Đồng bộ audio với trạng thái isPlaying
    if (!isPremium && audioRef.current) {
      if (isPlaying && !userPaused) {
        console.log("Attempting to play audio");
        // Nếu có vị trí đã lưu và đang phát lại sau khi tạm dừng, khôi phục vị trí
        if (savedPosition > 0 && userPaused === false) {
          try {
            audioRef.current.currentTime = savedPosition;
            console.log("Restored to position:", savedPosition);
          } catch (err) {
            console.error("Không thể khôi phục vị trí:", err);
          }
        }

        audioRef.current.play().catch((err) => {
          console.error("Lỗi khi phát nhạc:", err);
          // Nếu không thể phát, reset trạng thái
          setIsPlaying(false);
          setUserPaused(true);
        });
      } else if (!isPlaying || userPaused) {
        console.log("Pausing audio at position:", audioRef.current.currentTime);
        audioRef.current.pause();
      }
    }
  }, [
    isPlaying,
    isPremium,
    previewUrl,
    userPaused,
    setUserPaused,
    savedPosition,
    setIsPlaying,
  ]);

  // Hàm phát preview
  const playPreview = () => {
    if (audioRef.current) {
      audioRef.current.play();
    }
  };

  // Hàm tạm dừng preview
  const pausePreview = () => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
  };

  // Hàm lấy danh sách URI từ tracks
  const getTrackUris = () => {
    if (!tracks || tracks.length === 0) return [];
    return tracks
      .map((item) => {
        const track = item.track || item;
        return track.uri || `spotify:track:${track.id}`;
      })
      .filter((uri) => uri);
  };

  // Xử lý khi người dùng chọn thiết bị
  // const handleDeviceSelect = (deviceId) => {
  //   setActiveDevice(deviceId);
  //   setShowDeviceSelector(false);
  // };

  const handleProgressChange = (value) => {
    console.log("Changing progress to:", value);
    setTrackProgress(value);

    if (isPremium) {
      try {
        axios.put("https://api.spotify.com/v1/me/player/seek", null, {
          params: {
            position_ms: Math.round(value * 1000),
          },
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
      } catch (err) {
        console.error("Lỗi khi tua:", err);
      }
    } else if (audioRef.current) {
      audioRef.current.currentTime = value;
    }
  };

  // Volume control handlers
  const handleVolumeChange = (newVolume) => {
    const clampedVolume = Math.max(0, Math.min(1, newVolume));
    setVolume(clampedVolume);
    if (clampedVolume > 0 && isMuted) {
      setIsMuted(false);
    }
  };

  const handleMuteToggle = () => {
    if (isMuted) {
      // Unmute: restore previous volume
      setIsMuted(false);
      setVolume(previousVolume);
    } else {
      // Mute: save current volume and set to 0
      setPreviousVolume(volume);
      setIsMuted(true);
    }
  };

  return (
    <div className="w-full flex flex-col items-center">
      {error && (
        <div className="mb-4 p-3 bg-red-500 text-white rounded-lg">{error}</div>
      )}

      {/* Audio Player cho Preview */}
      {!isPremium && previewUrl && (
        <audio
          ref={audioRef}
          src={previewUrl}
          onEnded={handleTrackEnd}
          onTimeUpdate={() => {
            if (audioRef.current && isPlaying && !userPaused) {
              setTrackProgress(audioRef.current.currentTime);
              setDuration(audioRef.current.duration || 30); // Default 30s for preview
            } else if (audioRef.current && userPaused && savedPosition > 0) {
              // Khi tạm dừng, vẫn giữ giá trị trackProgress bằng vị trí đã lưu
              setTrackProgress(savedPosition);
            }
          }}
          onLoadedMetadata={() => {
            if (audioRef.current) {
              setDuration(audioRef.current.duration || 30);
            }
          }}
        />
      )}

      {/* Spotify Web Player (chỉ hiển thị khi là Premium) */}
      {isPremium && (
        <div
          className="spotify-web-player"
          style={{ height: "0px", width: "0px", overflow: "hidden" }}
        >
          <SpotifyWebPlayer
            token={token}
            uris={getTrackUris()}
            play={isPlaying && !userPaused}
            offset={currentIndex}
            // name={`Web Player (${document.title}) - mainAudioPlayer`}

            callback={(state) => {
              if (state) {
                // Chỉ cập nhật isPlaying nếu không phải do người dùng chủ động tạm dừng
                if (!userPaused) {
                  console.log(
                    "SpotifyWebPlayer callback - state.paused:",
                    state.paused
                  );
                  setIsPlaying(!state.paused);
                }

                // Chỉ cập nhật vị trí phát nếu đang phát
                if (!state.paused && !userPaused) {
                  if (state.position !== undefined) {
                    setTrackProgress(state.position / 1000);
                  }
                  if (state.duration !== undefined) {
                    setDuration(state.duration / 1000);

                    // Kiểm tra nếu bài hát đã kết thúc
                    if (state.position >= state.duration - 500) {
                      // Trừ 500ms
                      handleTrackEnd();
                    }
                  }
                }
              }
            }}
            onEnded={handleTrackEnd}
            onError={(error) => setError(error.message)}
          />
        </div>
      )}

      {/* Controls */}
      <Controls
        isPlaying={isPlaying}
        onPlayPause={() => {
          console.log(
            "Play/Pause clicked, current state:",
            isPlaying,
            "userPaused:",
            userPaused
          );

          if (isPlaying) {
            // Đang phát -> dừng
            setIsPlaying(false);
            setUserPaused(true);
            console.log("Setting to PAUSE state");
            if (isPremium && activeDevice) {
              pauseOnDevice();
            } else if (audioRef.current) {
              // Lưu vị trí hiện tại trước khi tạm dừng
              setSavedPosition(audioRef.current.currentTime);
              console.log(
                "Saving position before pause:",
                audioRef.current.currentTime
              );
              audioRef.current.pause();
            }
          } else {
            // Đang dừng -> phát
            setIsPlaying(true);
            setUserPaused(false);
            console.log("Setting to PLAY state");
            if (isPremium && activeDevice) {
              playOnDevice();
            } else if (audioRef.current) {
              // Khôi phục vị trí phát nếu có
              if (savedPosition > 0) {
                try {
                  audioRef.current.currentTime = savedPosition;
                  console.log("Restoring position on play:", savedPosition);
                } catch (err) {
                  console.error("Không thể khôi phục vị trí:", err);
                }
              }

              audioRef.current.play().catch((err) => {
                console.error("Không thể phát nhạc:", err);
                setIsPlaying(false);
                setUserPaused(true);
              });
            }
          }
        }}
        onSkipNext={() => {
          if (currentIndex < tracks.length - 1) {
            setCurrentIndex(currentIndex + 1);
          }
        }}
        onSkipPrevious={() => {
          if (currentIndex > 0) {
            setCurrentIndex(currentIndex - 1);
          }
        }}
        isPremium={isPremium}
        trackProgress={trackProgress}
        duration={duration}
        onProgressChange={handleProgressChange}
        volume={volume}
        onVolumeChange={handleVolumeChange}
        isMuted={isMuted}
        onMuteToggle={handleMuteToggle}
        isShuffled={false}
        onShuffleToggle={() => {}}
        repeatMode="none"
        onRepeatToggle={() => {}}
      />

      {/* Device Selector */}
      {/* {isPremium && (
          <div className="mt-4">
            <button
              onClick={() => setShowDeviceSelector(true)}
              className="text-white bg-[#1DB954] px-4 py-2 rounded-full hover:bg-[#1ed760] transition-colors"
            >
              {activeDevice ? 'Thay đổi thiết bị' : 'Chọn thiết bị phát nhạc'}
            </button>

            {showDeviceSelector && (
              <DeviceSelector
                token={token}
                onSelect={handleDeviceSelect}
                onClose={() => setShowDeviceSelector(false)}
              />
            )}
          </div>
        )} */}
    </div>
  );
}

// Hàm format thời gian
// const formatTime = (time) => {
//   if (!time || isNaN(time)) return "0:00";

//   const minutes = Math.floor(time / 60);
//   const seconds = Math.floor(time % 60);

//   return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
// };


