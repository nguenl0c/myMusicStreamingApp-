import React, { useState, useEffect } from 'react'
import SidebarButton from './sidebarButton.jsx'

import { MdOutlineLibraryMusic } from "react-icons/md";
import { FaPlay } from "react-icons/fa";
import { IoLogOut } from "react-icons/io5";
import { IoSearch } from "react-icons/io5";
import { PiPlaylistBold } from "react-icons/pi";
import { RxMixerVertical } from "react-icons/rx";
import { getAPIKit, clearAllTokens } from "../../spotify";


export default function Sidebar() {
  const [image, setImage] = useState(
    "https://i.pinimg.com/originals/59/28/95/5928959d2219ea674c7f478841a53955.png" // Ảnh mặc định
  );
  const [userInfo, setUserInfo] = useState(null);
  const [showTooltip, setShowTooltip] = useState(false);
  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        const api = getAPIKit(); // Luôn lấy instance mới với token mới nhất
        const response = await api.get("me");
        if (response.data.images && response.data.images.length > 0) {
          setImage(response.data.images[0].url);
        }
        
        // Lưu thông tin user để hiển thị trong tooltip
        setUserInfo({
          name: response.data.display_name || response.data.id,
          email: response.data.email,
          product: response.data.product // "premium" hoặc "free"
        });
      } catch (error) {
        console.error("Không thể lấy thông tin người dùng:", error);
        // Nếu lỗi 401 (Unauthorized) - có thể token đã hết hạn
        if (error.response && error.response.status === 401) {
          handleLogout();
        }
      }
    };
    
    fetchUserProfile();
  }, []);

  const handleLogout = () => {
    // Sử dụng hàm chung để xóa tất cả token
    clearAllTokens();
    
    // Hard refresh để đảm bảo tất cả state được reset
    window.location.replace("/");
  };

  return (
    <div className="w-[100px] h-full flex flex-col items-center bg-[#121212]">
      {/* Avatar với tooltip */}
      <div 
        className="relative mt-5"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <img
          src={image}
          alt="profile"
          className="w-[50px] h-[50px] rounded-md border-2 border-white cursor-pointer hover:border-green-500 transition-colors duration-200"
        />
        
        {/* Tooltip */}
        {showTooltip && userInfo && (
          <div className="absolute left-16 top-0 bg-gray-900 text-white p-3 rounded-lg shadow-lg z-50 whitespace-nowrap">
            <div className="text-sm font-semibold">{userInfo.name}</div>
            <div className="text-xs text-gray-300">{userInfo.email}</div>
            <div className={`text-xs font-medium ${
              userInfo.product === 'premium' ? 'text-yellow-400' : 'text-gray-400'
            }`}>
              {userInfo.product === 'premium' ? '👑 Premium' : '🆓 Free'}
            </div>
            {/* Mũi tên tooltip */}
            <div className="absolute left-[-8px] top-4 w-0 h-0 border-t-[8px] border-t-transparent border-b-[8px] border-b-transparent border-r-[8px] border-r-gray-900"></div>
          </div>
        )}
      </div>
      <div className="flex flex-col h-full justify-center">
        <SidebarButton title="Search" to="/search" icon={<IoSearch />} />
        <SidebarButton
          title="Mixer"
          to="/Mixer"
          icon={<RxMixerVertical />}
        />
        <SidebarButton title="Play" to="/players" icon={<FaPlay />} />
        <SidebarButton
          title="Virtual"
          to="/playlists"
          icon={<PiPlaylistBold />}
        />
        <SidebarButton
          title="Library"
          to="/library"
          icon={<MdOutlineLibraryMusic />}
        />
      </div>
      {/* Thay đổi từ thẻ liên kết sang button xử lý sự kiện logout */}
      <div onClick={handleLogout}>
        <SidebarButton title="Log Out" to="#" icon={<IoLogOut />} />
      </div>
    </div>
  );
}
