
import { useState, useEffect } from 'react';
import { getAccessToken, setClientToken, isTokenExpired, refreshToken } from "../spotify.js";
import { Routes, Route, Navigate } from "react-router-dom";
import axios from 'axios';
import Login from './auth/login.jsx';
import Search from './search.jsx';
import Library from './library';
import Players from './PlayersUpdate.jsx';
import Sidebar from '../components/sidebar/sidebar.jsx';
import UnifiedPlaylists from './unifiedPlaylists';
import PlayUnifiedPlaylist from './playUnifiedPlaylist';
import Mixer from './MixerUpdate.jsx'
import KaraokeCreator from './KaraokeCreator.jsx';

export default function Home() {
  const [token, setToken] = useState("");
  const [isPremium, setIsPremium] = useState(false);
  const [user, setUser] = useState(null);
  const [checkingPremium, setCheckingPremium] = useState(false);
  const [premiumError, setPremiumError] = useState(null);
  
  // Kiểm tra tài khoản Premium
  const checkPremiumStatus = async (token) => {
    if (!token) return;
    
    setCheckingPremium(true);
    setPremiumError(null);
    
    try {
      console.log('Đang kiểm tra trạng thái Premium...');
      const response = await axios.get('http://localhost:5000/auth/check-premium', {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (!response.data) {
        throw new Error('Không nhận được dữ liệu từ server');
      }
      
      const { isPremium, user } = response.data;
      setIsPremium(isPremium);
      setUser(user);
      
      console.log('Premium status:', isPremium ? 'Premium' : 'Free', 'User:', user?.name);
      
      if (isPremium) {
        // Lưu trạng thái Premium vào localStorage để tránh kiểm tra lại
        localStorage.setItem('spotify_is_premium', 'true');
        localStorage.setItem('spotify_user', JSON.stringify(user));
      } else {
        localStorage.removeItem('spotify_is_premium');
      }
      
      return isPremium;
    } catch (error) {
      console.error('Lỗi khi kiểm tra tài khoản Premium:', error);
      setPremiumError(error.message || 'Không thể kiểm tra trạng thái Premium');
      setIsPremium(false);
      return false;
    } finally {
      setCheckingPremium(false);
    }
  };
  
  // Thử lại kết nối
  const handleRetry = async () => {
    if (token) {
      await checkPremiumStatus(token);
    } else {
      const currentToken = getAccessToken();
      if (currentToken) {
        setToken(currentToken);
        await checkPremiumStatus(currentToken);
      }
    }
  };
  
  useEffect(() => {
    const checkAndSetupToken = async () => {
      console.log('=== HOME TOKEN CHECK ===');
      
      // Lấy token từ localStorage thông qua hàm chung
      let currentToken = getAccessToken();
      console.log('Token from localStorage:', currentToken ? currentToken.substring(0, 20) + '...' : 'null');
      
      // Kiểm tra hash URL cho trường hợp redirect từ implicit grant
      const hash = window.location.hash;
      window.location.hash = "";
      
      if (!currentToken && hash) {
        console.log('Found token in hash, extracting...');
        const _token = hash.split("&")[0].split("=")[1];
        setClientToken(_token);
        currentToken = _token;
      }
      
      // Kiểm tra token hết hạn
      if (currentToken && isTokenExpired()) {
        console.log("Token hết hạn, đang làm mới...");
        currentToken = await refreshToken();
      }
      
      if (currentToken) {
        console.log('Setting token in state...');
        setToken(currentToken);
        
        // Kiểm tra xem đã có thông tin Premium trong localStorage chưa
        const cachedPremium = localStorage.getItem('spotify_is_premium');
        const cachedUser = localStorage.getItem('spotify_user');
        
        if (cachedPremium === 'true' && cachedUser) {
          // Nếu đã có thông tin trong cache, sử dụng nó
          setIsPremium(true);
          setUser(JSON.parse(cachedUser));
          console.log('Đã lấy trạng thái Premium từ cache:', true);
        } else {
          // Nếu chưa có trong cache, kiểm tra API
          await checkPremiumStatus(currentToken);
        }
      } else {
        console.log('No valid token found, showing login');
      }
    };
    
    // Chạy ngay lập tức
    checkAndSetupToken();
    
    // Lắng nghe storage events để tự động cập nhật khi token thay đổi
    const handleStorageChange = (e) => {
      if (e.key === 'spotify_access_token' && e.newValue) {
        console.log('Token changed in localStorage, updating...');
        checkAndSetupToken();
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    
    // Cleanup
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);
  
  // Thêm effect để theo dõi localStorage changes
  useEffect(() => {
    const interval = setInterval(() => {
      const currentToken = getAccessToken();
      if (currentToken && !token) {
        console.log('Token detected, updating state...');
        setToken(currentToken);
      }
    }, 500);
    
    return () => clearInterval(interval);
  }, [token]);
  
  // Hiển thị banner thông báo nếu không phải tài khoản Premium
  const PremiumBanner = () => {
    if (!token || checkingPremium) return null;
    
    if (premiumError) {
      return (
        <div className="fixed top-0 left-0 w-full bg-red-600 text-white p-2 text-center z-50">
          Lỗi khi kiểm tra tài khoản Premium: {premiumError}
          <button 
            onClick={handleRetry}
            className="ml-2 px-3 py-1 bg-white text-red-600 rounded-full text-sm font-medium"
          >
            Thử lại
          </button>
        </div>
      );
    }
    
    return !isPremium ? (
      <div className="fixed top-0 left-0 w-full bg-red-600 text-white p-2 text-center z-50">
        Bạn đang sử dụng tài khoản Spotify Free. Để nghe toàn bộ bài hát, vui lòng nâng cấp lên Spotify Premium.
        <a 
          href="https://www.spotify.com/premium/" 
          target="_blank" 
          rel="noopener noreferrer"
          className="ml-2 underline"
        >
          Nâng cấp ngay
        </a>
      </div>
    ) : null;
  };
  
  return !token ? (
    <Login />
  ) : (
    <div className="h-screen w-screen bg-[#121212] flex flex-col">
      <PremiumBanner />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <div
          className={`flex-1 overflow-auto ${
            !isPremium || premiumError ? "pt-10" : ""
          }`}
        >
          <Routes>
            <Route path="/" element={<Navigate to="/players" replace />} />
            <Route path="/search" element={<Search />} />
            <Route
              path="/players"
              element={<Players isPremium={isPremium} user={user} />}
            />
            <Route path="/library" element={<Library />} />
            <Route path="/mixer" element={<Mixer />} />
            <Route path="/karaoke" element={<KaraokeCreator />} />
            <Route path="/playlists" element={<UnifiedPlaylists />} />
            <Route path="/play/:playlistId" element={<PlayUnifiedPlaylist />} />
          </Routes>
        </div>
      </div>
      {/* Debug Panel */}
      <div className="fixed top-0 right-0 bg-black/30 text-white p-2 text-xs z-50 max-w-xs">
        <p>Premium: {isPremium ? "Yes" : "No"}</p>
        <p>Token: {token ? token.substring(0, 10) + "..." : "None"}</p>
        {user && <p>User: {user.name}</p>}
        <button
          onClick={handleRetry}
          className="mt-1 px-2 py-1 bg-blue-600 text-white rounded text-xs"
        >
          Refresh Status
        </button>
      </div>
    </div>
  );
}