// src/components/audioPlayer/queue.jsx
import { IconContext } from 'react-icons';
import { BsPauseCircleFill } from 'react-icons/bs';

export default function Queue({ tracks, playerState, onSelectTrack }) {
  if (!tracks || tracks.length === 0) {
    return (
      <div className="w-full flex flex-col justify-center items-center p-4">
        <p className="text-lg font-medium text-white">Không có bài hát trong hàng đợi</p>
      </div>
    );
  }

  const currentTrackId = playerState?.track_window?.current_track?.id;
  const isPlaying = playerState ? !playerState.paused : false;

  return (
    <div className="w-full p-4 h-full overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-100">
      <div className="flex flex-col gap-4">
        {tracks.map((item, index) => {
          const track = item.track || item;
          if (!track) return null; // Bỏ qua các item không hợp lệ

          const isCurrentTrack = track.id === currentTrackId;
          const imageUrl = track.album?.images?.[0]?.url || 'https://via.placeholder.com/80';

          return (
            <div
              key={index + "-" + track.id}
              className={`transition-all duration-300 w-full p-3 rounded-2xl flex items-center gap-4 cursor-pointer
                          ${isCurrentTrack ? "bg-blue-500/20" : "bg-gray-500/10 hover:bg-gray-500/20"}`}
              onClick={() => onSelectTrack(track.uri)}
            >
              {/* Album Cover */}
              <img
                src={imageUrl}
                alt={track.name}
                className="w-12 h-12 object-cover rounded-md flex-shrink-0"
              />

              {/* Thông tin bài hát */}
              <div className="flex-1 min-w-0">
                <p className={`font-medium text-sm truncate ${isCurrentTrack ? "text-blue-400" : "text-white"}`}>
                  {track.name}
                </p>
                <p className="text-gray-400 text-xs truncate mt-1">
                  {track.artists?.map(artist => artist.name).join(", ")}
                </p>
              </div>

              {/* Chỉ báo bài hát đang phát */}
              {isCurrentTrack && (
                <div className="flex-shrink-0 ml-2 pr-2">
                  <IconContext.Provider value={{ size: "24px", color: "#1DB954" }}>
                    {isPlaying ? (
                      <div className="flex gap-1 items-center">
                        <span className="w-1 h-3 bg-green-500 animate-[bounce_0.5s_ease-in-out_infinite]"></span>
                        <span className="w-1 h-5 bg-green-500 animate-[bounce_0.7s_ease-in-out_infinite]"></span>
                        <span className="w-1 h-3 bg-green-500 animate-[bounce_0.5s_ease-in-out_infinite]"></span>
                      </div>
                    ) : (
                      <BsPauseCircleFill />
                    )}
                  </IconContext.Provider>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
