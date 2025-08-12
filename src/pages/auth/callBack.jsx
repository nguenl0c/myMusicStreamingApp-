import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { handleCallback, saveTokensToStorage } from '../../spotify';

const Callback = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const fetchToken = async () => {
      console.log('=== CALLBACK DEBUG ===');
      console.log('Current URL:', window.location.href);
      
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      const error = urlParams.get('error');
      
      console.log('Code from URL:', code ? code.substring(0, 10) + '...' : 'null');
      console.log('Error from URL:', error);
      
      if (error) {
        console.error('OAuth error:', error);
        navigate('/');
        return;
      }
      
      if (code) {
        console.log('Processing authorization code...');
        // Xóa code khỏi URL để không dùng lại
        window.history.replaceState({}, document.title, "/callback");
        
        const data = await handleCallback(code);
        console.log('Callback result:', data ? 'success' : 'failed');
        
        if (data) {
          console.log('Token received, saving to storage...');
          // Sử dụng hàm chung để lưu token
          saveTokensToStorage(data);
          
          // Kiểm tra xem token đã được lưu chưa
          setTimeout(() => {
            const savedToken = localStorage.getItem('spotify_access_token');
            console.log('Token saved check:', savedToken ? 'YES' : 'NO');
            console.log('Navigating to /players...');
            // Sử dụng window.location.href để force reload và đảm bảo Home component nhận token mới
            window.location.href = '/players';
          }, 200);
        } else {
          console.error('Failed to get token, redirecting to home');
          navigate('/');
        }
      } else {
        console.log('No code in URL, redirecting to home');
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