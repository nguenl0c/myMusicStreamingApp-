import React, { useState, useEffect, useCallback, useRef } from "react";
import { getAPIKit } from "../spotify";
import { useNavigate } from "react-router-dom";
import PlaylistItem from "../components/PlaylistItem.jsx"; 

// --- Hằng số để dễ quản lý ---
const INITIAL_URL = "me/playlists?limit=30";
const SCROLL_THRESHOLD = 50; // px
const DEBOUNCE_DELAY = 100; // ms

export default function Library() {
  const [playlists, setPlaylists] = useState([]);
  const [status, setStatus] = useState("loading"); // 'loading', 'success', 'error'
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [nextUrl, setNextUrl] = useState(null);
  const [error, setError] = useState(null);

  const scrollContainerRef = useRef(null);
  const scrollTimeoutRef = useRef(null);
  const navigate = useNavigate();

  const fetchPlaylists = useCallback(async (url, { append = false } = {}) => {
    // Đặt trạng thái tương ứng
    if (append) {
      setIsLoadingMore(true);
    } else {
      setStatus("loading");
    }
    setError(null);

    try {
      const api = getAPIKit();
      const response = await api.get(url);

      if (!response.data || !response.data.items) {
        throw new Error("Dữ liệu trả về không hợp lệ");
      }

      setPlaylists(prev => append ? [...prev, ...response.data.items] : response.data.items);

      if (response.data.next) {
        const nextUrlObject = new URL(response.data.next);
        const nextRelativeUrl = (nextUrlObject.pathname + nextUrlObject.search).replace('/v1', '');
        setNextUrl(nextRelativeUrl);
      } else {
        setNextUrl(null);
      }

      setStatus("success");
    } catch (err) {
      console.error("Không thể lấy playlist:", err);
      setError(err.message || "Đã xảy ra lỗi khi tải playlist");
      setStatus("error");
      // Không cần set playlist về mảng rỗng vì state `status` đã xử lý việc hiển thị
    } finally {
      setIsLoadingMore(false);
    }
  }, []);

  // Lấy dữ liệu lần đầu
  useEffect(() => {
    fetchPlaylists(INITIAL_URL);
  }, [fetchPlaylists]);

  // Logic xử lý cuộn trang
  const handleScroll = useCallback(() => {
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }

    scrollTimeoutRef.current = setTimeout(() => {
      const container = scrollContainerRef.current;
      if (!container) return;

      const { scrollTop, scrollHeight, clientHeight } = container;
      const isNearBottom = scrollHeight - scrollTop - clientHeight < SCROLL_THRESHOLD;

      if (isNearBottom && nextUrl && !isLoadingMore && status !== "loading") {
        fetchPlaylists(nextUrl, { append: true });
      }
    }, DEBOUNCE_DELAY);
  }, [nextUrl, isLoadingMore, status, fetchPlaylists]);

  const playPlaylist = (id) => {
    navigate("/players", { state: { id: id } });
  };

  const renderContent = () => {
    if (status === "loading") {
      return (
        <div className="w-full flex justify-center items-center h-40">
          <div className="w-10 h-10 border-4 border-[#2ecd67] border-t-transparent rounded-full animate-spin"></div>
        </div>
      );
    }

    if (status === "error") {
      return (
        <div className="w-full text-center text-red-500 mt-10">
          <p>❌ {error}</p>
          <button
            onClick={() => fetchPlaylists(INITIAL_URL)}
            className="mt-4 px-4 py-2 bg-[#2ecd67] text-white rounded-lg hover:bg-[#25a855]"
          >
            Thử lại
          </button>
        </div>
      );
    }

    if (playlists.length === 0) {
      return (
        <div className="w-full text-center text-[#c4d0e3] mt-10">
          Không tìm thấy playlist nào. Hãy tạo playlist mới trên Spotify!
        </div>
      );
    }

    return (
      <>
        {playlists.map((playlist) => (
          <PlaylistItem key={playlist.id} playlist={playlist} onPlay={playPlaylist} />
        ))}

        {isLoadingMore && (
          <div className="w-full flex justify-center items-center h-20">
            <div className="w-8 h-8 border-4 border-[#2ecd67] border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}

        {!isLoadingMore && !nextUrl && playlists.length > 0 && (
          <div className="w-full text-center text-black/80 mt-10 opacity-60">
            🎵 Đã hiển thị tất cả playlist ({playlists.length} playlists)
          </div>
        )}
      </>
    );
  };

  return (
    <div className="screen-container w-full h-full p-0 m-0">
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="w-full h-full p-[3%] flex flex-wrap justify-center content-start gap-6 overflow-y-auto" 
      >
        {renderContent()}
      </div>
    </div>
  );
}