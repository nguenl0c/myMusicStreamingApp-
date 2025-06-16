import React from "react";
import { IconContext } from 'react-icons';
import { BsPlayCircleFill, BsPauseCircleFill } from 'react-icons/bs';

export default function Queue({ tracks, setCurrentIndex, currentIndex = 0, isPlaying, onPlayPause }) {
  if (!tracks || tracks.length === 0) {
    return (
      <div className="w-full rounded-t-3xl bg-[#3b3b3b] flex flex-col justify-center items-center p-4">
        <p className="text-lg font-medium text-white">Không có bài hát trong hàng đợi</p>
      </div>
    );
  }

  const handlePlayPause = (e, index) => {
    e.stopPropagation(); // Ngăn chặn sự kiện click lan ra ngoài
    if (index === currentIndex) {
      onPlayPause(); // Gọi hàm play/pause nếu là bài hát hiện tại
    } else {
      setCurrentIndex(index); // Chuyển sang bài hát khác nếu click vào bài khác
    }
  };

  return (
    <div className="w-full p-4">
      {/* Danh sách phát theo chiều ngang */}
        <div className="w-full overflow-x-auto hide-scrollbar pb-4">
          <div className="flex gap-6 px-2 py-1">
            {tracks.map((item, index) => {
              const track = item.track || item;
              const isCurrentTrack = index === currentIndex;
              const imageUrl = track.album?.images?.[0]?.url || 'https://via.placeholder.com/80';

              return (
                <div
                  key={index + "-" + track.id}
                  className={`flex-shrink-0 transition-all duration-300 w-50 md:w-60 
                              ${isCurrentTrack ? "transform scale-105" : "hover:scale-105"}
                              relative`}
                  onClick={() => setCurrentIndex(index)}
                >
                  <div className={`relative bg-gradient-to-br from-[#ffffff] to-[#C9DFF5] 
                                  rounded-3xl overflow-hidden cursor-pointer shadow-md flex items-center px-2 py-4
                                ${isCurrentTrack ? "ring-2 ring-[#3A8AE7]" : ""}`}>
                    {/* Album Cover */}
                    <div className="w-16 h-16 flex-shrink-0 relative">
                      {/* Lớp nền blur */}
                      <div
                        className="absolute inset-0 rounded-2xl"
                        style={{
                          backgroundImage: `url(${imageUrl})`,
                          backgroundSize: 'cover',
                          backgroundPosition: 'center',
                          filter: 'blur(8px)',
                          opacity: 0.7,
                          zIndex: 1,
                        }}
                      />
                      {/* Ảnh cover phía trên */}
                      <img
                        src={imageUrl}
                        alt={track.name}
                        className="w-full h-full object-cover rounded-2xl relative z-10 border-2 border-white"
                      />
                    </div>

                    {/* Thông tin bài hát */}
                    <div className="ml-3 flex-1 min-w-0">
                      <p className={`font-medium text-sm truncate ${isCurrentTrack ? "text-[#3A8AE7]" : "text-gray-800"}`}>
                        {track.name}
                      </p>
                      <p className="text-gray-400 text-xs truncate mt-1">
                        {track.artists?.map(artist => artist.name).join(", ")}
                      </p>
                    </div>

                    {/* Nút play/pause */}
                    <div className="flex-shrink-0 ml-2 pr-2">
                      <IconContext.Provider value={{ size: "32px", color: isCurrentTrack ? "#3A8AE7" : "#8E9EB3" }}>
                        <button 
                          className="focus:outline-none hover:scale-110 transition-transform"
                          onClick={(e) => handlePlayPause(e, index)}
                        >
                          {isCurrentTrack && isPlaying ? <BsPauseCircleFill /> : <BsPlayCircleFill />}
                        </button>
                      </IconContext.Provider>
                    </div>

                    {/* Chỉ báo bài hát đang phát */}
                    {isCurrentTrack && (
                      <div className="absolute top-2 right-2 bg-[#1DB954] w-2 h-2 rounded-full pulse-animation"></div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
    </div>
  );
}

// Thêm các styles cần thiết vào document
if (typeof document !== 'undefined') {
  // Chỉ thực hiện trên client-side
  const style = document.createElement('style');
  style.innerHTML = `
    .hide-scrollbar::-webkit-scrollbar {
      height: 0;
      display: none;
    }
    .hide-scrollbar {
      -ms-overflow-style: none;
      scrollbar-width: none;
    }
    
    @keyframes pulse {
      0% { box-shadow: 0 0 0 0 rgba(29, 185, 84, 0.7); }
      70% { box-shadow: 0 0 0 5px rgba(29, 185, 84, 0); }
      100% { box-shadow: 0 0 0 0 rgba(29, 185, 84, 0); }
    }
    
    .pulse-animation {
      animation: pulse 1.5s infinite;
    }
  `;
  document.head.appendChild(style);
}