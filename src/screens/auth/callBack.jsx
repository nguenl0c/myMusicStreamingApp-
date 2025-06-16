import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { handleCallback, saveTokensToStorage } from '../../spotify';

const Callback = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const fetchToken = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      
      if (code) {
        // Xóa code khỏi URL để không dùng lại
        window.history.replaceState({}, document.title, "/callback");
        
        const data = await handleCallback(code);
        if (data) {
          // Sử dụng hàm chung để lưu token
          saveTokensToStorage(data);
          
          setTimeout(() => {
            navigate('/library');
          }, 100);
        } else {
          navigate('/');
        }
      } else {
        navigate('/');
      }
    };
    
    fetchToken();
  }, [navigate]);

  return (
    <div className="flex items-center justify-center h-screen bg-gray-900">
      <div className="text-white text-center">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-green-500 mx-auto mb-4"></div>
        <p className="text-xl">Đang xử lý đăng nhập...</p>
      </div>
    </div>
  );
};

export default Callback;