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
  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        const api = getAPIKit(); // Luôn lấy instance mới với token mới nhất
        const response = await api.get("me");
        if (response.data.images && response.data.images.length > 0) {
          setImage(response.data.images[0].url);
        }
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
      <img
        src={image}
        alt="profile"
        className="w-[50px] h-[50px] rounded-md mt-5 border-2 border-white"
      />
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
