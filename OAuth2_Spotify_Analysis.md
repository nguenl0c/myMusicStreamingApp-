# PHÂN TÍCH QUY TRÌNH XỬ LÝ OAUTH 2.0 VỚI SPOTIFY API

## 1. Tổng quan về OAuth 2.0 trong Hệ thống

OAuth 2.0 (Open Authorization 2.0) là một giao thức ủy quyền tiêu chuẩn được sử dụng để cho phép các ứng dụng bên thứ ba truy cập tài nguyên của người dùng mà không cần tiết lộ thông tin đăng nhập. Trong dự án Music Streaming AI, OAuth 2.0 được triển khai để tích hợp với Spotify API, cho phép ứng dụng truy cập vào thư viện nhạc, playlist và các chức năng phát nhạc của người dùng Spotify.

## 2. Kiến trúc OAuth 2.0 trong Dự án

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend       │    │   Spotify API   │
│   (React)       │    │   (Node.js)     │    │   (OAuth Server)│
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                        │                        │
         │ 1. Yêu cầu đăng nhập    │                        │
         ├────────────────────────▶│                        │
         │                        │ 2. Redirect to Spotify │
         │                        ├───────────────────────▶│
         │                        │                        │
         │ 3. User Authorization  │                        │
         │◄───────────────────────┼────────────────────────┤
         │                        │                        │
         │ 4. Authorization Code  │                        │
         ├────────────────────────▶│                        │
         │                        │ 5. Exchange for Token  │
         │                        ├───────────────────────▶│
         │                        │ 6. Access Token        │
         │                        │◄───────────────────────┤
         │ 7. Token Response      │                        │
         │◄───────────────────────┤                        │
```

## 3. Luồng Xử lý OAuth 2.0 Chi tiết

### 3.1. Bước 1: Khởi tạo Đăng nhập

**Frontend (Login Component)**:
```jsx
// src/screens/auth/login.jsx
const Login = () => {
  return (
    <div className="flex items-center justify-center h-screen bg-gray-900">
      <a 
        href="http://localhost:5000/auth/login" 
        className="bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-6 rounded-full"
      >
        Đăng nhập với Spotify
      </a>
    </div>
  );
};
```

Khi người dùng nhấp vào nút "Đăng nhập với Spotify", trình duyệt sẽ chuyển hướng đến endpoint `/auth/login` trên backend.

### 3.2. Bước 2: Tạo Authorization URL

**Backend Authorization Endpoint**:
```javascript
// server/index.js - GET /auth/login
app.get('/auth/login', (req, res) => {
  const state = generateRandomString(16);
  const scope = [
    'streaming', 'app-remote-control',
    'user-read-playback-state', 'user-modify-playback-state',
    'user-library-read', 'playlist-read-private',
    'user-read-email', 'user-read-private'
  ].join(' ');

  res.redirect('https://accounts.spotify.com/authorize?' +
    querystring.stringify({
      response_type: 'code',
      client_id: process.env.SPOTIFY_CLIENT_ID,
      scope: scope,
      redirect_uri: process.env.REDIRECT_URI,
      state: state,
      show_dialog: true
    })
  );
});
```

Backend thực hiện các công việc sau:
- Tạo một `state` ngẫu nhiên để bảo mật (chống CSRF attacks)
- Định nghĩa các `scope` quyền truy cập cần thiết
- Redirect người dùng đến trang ủy quyền của Spotify

### 3.3. Bước 3: Người dùng Ủy quyền

Spotify hiển thị trang consent screen cho người dùng với các quyền được yêu cầu:
- **streaming**: Phát nhạc trên ứng dụng
- **user-read-playback-state**: Đọc trạng thái phát nhạc
- **user-library-read**: Truy cập thư viện cá nhân
- **playlist-read-private**: Đọc playlist riêng tư

### 3.4. Bước 4: Nhận Authorization Code

Sau khi người dùng đồng ý, Spotify redirect về `REDIRECT_URI` với:
```
http://localhost:5173/callback?code=AQC8x7...&state=random_string
```

**Callback Component xử lý**:
```jsx
// src/screens/auth/callBack.jsx
const Callback = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const fetchToken = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      
      if (code) {
        window.history.replaceState({}, document.title, "/callback");
        const data = await handleCallback(code);
        
        if (data) {
          saveTokensToStorage(data);
          navigate('/library');
        }
      }
    };
    
    fetchToken();
  }, [navigate]);
};
```

### 3.5. Bước 5: Trao đổi Authorization Code lấy Access Token

**Frontend gửi code đến backend**:
```javascript
// src/spotify.js - handleCallback function
export const handleCallback = async (code) => {
  try {
    const response = await axios.post(`${BACKEND_URL}/auth/token`, { code });
    saveTokensToStorage(response.data);
    return response.data;
  } catch (error) {
    console.error('Error getting token:', error);
    return null;
  }
};
```

**Backend trao đổi với Spotify**:
```javascript
// server/index.js - POST /auth/token
app.post('/auth/token', async (req, res) => {
  const code = req.body.code;
  
  try {
    const response = await axios({
      method: 'post',
      url: 'https://accounts.spotify.com/api/token',
      data: querystring.stringify({
        code: code,
        redirect_uri: process.env.REDIRECT_URI,
        grant_type: 'authorization_code'
      }),
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + Buffer.from(
          process.env.SPOTIFY_CLIENT_ID + ':' + process.env.SPOTIFY_CLIENT_SECRET
        ).toString('base64')
      }
    });

    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get token' });
  }
});
```

## 4. Quản lý Token và Refresh Mechanism

### 4.1. Lưu trữ Token

```javascript
// src/spotify.js - saveTokensToStorage
export const saveTokensToStorage = (data) => {
  if (!data || !data.access_token) return;
  
  localStorage.setItem('spotify_access_token', data.access_token);
  
  if (data.refresh_token) {
    localStorage.setItem('spotify_refresh_token', data.refresh_token);
  }
  
  if (data.expires_in) {
    const expiresAt = Date.now() + (data.expires_in - 60) * 1000;
    localStorage.setItem('spotify_expires_at', expiresAt);
  }
  
  localStorage.setItem('isLoggedIn', 'true');
};
```

### 4.2. Kiểm tra và Làm mới Token

```javascript
// src/spotify.js - Token validation và refresh
export const isTokenExpired = () => {
  const expiresAt = localStorage.getItem('spotify_expires_at');
  if (!expiresAt) return true;
  return Date.now() >= parseInt(expiresAt);
};

export const refreshToken = async () => {
  const refreshToken = localStorage.getItem('spotify_refresh_token');
  
  if (!refreshToken) {
    clearAllTokens();
    return null;
  }
  
  try {
    const response = await axios.post(`${BACKEND_URL}/auth/refresh_token`, {
      refresh_token: refreshToken
    });
    
    const { access_token, expires_in } = response.data;
    
    localStorage.setItem('spotify_access_token', access_token);
    const expiresAt = Date.now() + (expires_in - 60) * 1000;
    localStorage.setItem('spotify_expires_at', expiresAt);
    
    return access_token;
  } catch (error) {
    clearAllTokens();
    return null;
  }
};
```

## 5. Sử dụng Token cho API Calls

### 5.1. Wrapper Function cho Spotify API

```javascript
// src/spotify.js - callSpotifyAPI
export const callSpotifyAPI = async (method, endpoint, options = {}, retryCount = 0) => {
  try {
    const token = await getValidToken();
    if (!token) {
      throw new Error('Could not get valid token');
    }
    
    const headers = {
      ...options.headers,
      'Authorization': `Bearer ${token}`
    };
    
    const config = {
      ...options,
      headers,
      method,
      url: endpoint.startsWith('https://') ? endpoint : `https://api.spotify.com/v1${endpoint}`
    };
    
    const response = await axios(config);
    return response.data;
  } catch (error) {
    // Xử lý lỗi 401 - Token hết hạn
    if (error?.response?.status === 401 && retryCount < MAX_RETRIES) {
      localStorage.removeItem('spotify_expires_at');
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
      return callSpotifyAPI(method, endpoint, options, retryCount + 1);
    }
    
    throw error;
  }
};
```

### 5.2. Ví dụ Sử dụng trong Components

```javascript
// src/components/audioPlayer/spotifyHelper.js
export const playSpotifyTrack = async (token, deviceId, trackUri, position_ms = 0) => {
  try {
    await axios.put(
      `https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`,
      {
        uris: [trackUri],
        position_ms: position_ms
      },
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );
    return true;
  } catch (error) {
    console.error('Error playing Spotify track:', error);
    return false;
  }
};
```

## 6. Xử lý Lỗi và Bảo mật

### 6.1. Error Handling Strategy

1. **401 Unauthorized**: Tự động refresh token và retry
2. **429 Rate Limiting**: Chờ theo `Retry-After` header
3. **Network Errors**: Retry với exponential backoff
4. **Token Expired**: Tự động làm mới hoặc yêu cầu đăng nhập lại

### 6.2. Security Measures

1. **State Parameter**: Chống CSRF attacks
2. **HTTPS Only**: Đảm bảo truyền tải an toàn
3. **Token Expiry**: Giảm thời gian token để tăng bảo mật
4. **Scope Limitation**: Chỉ yêu cầu quyền cần thiết

## 7. Luồng Kiểm tra Premium

```javascript
// server/index.js - Premium check endpoint
app.get('/auth/check-premium', async (req, res) => {
  const token = req.headers.authorization?.split('Bearer ')[1];
  
  try {
    const response = await axios.get('https://api.spotify.com/v1/me', {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    const isPremium = response.data.product === 'premium';
    
    res.json({
      isPremium,
      user: {
        id: response.data.id,
        name: response.data.display_name,
        email: response.data.email,
        product: response.data.product
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Không thể kết nối với Spotify API' });
  }
});
```

## 8. Kết luận

Hệ thống OAuth 2.0 trong dự án được thiết kế với các đặc điểm chính:

1. **Tự động hóa**: Token được tự động làm mới khi hết hạn
2. **Resilient**: Xử lý lỗi và retry logic mạnh mẽ
3. **Secure**: Tuân thủ best practices của OAuth 2.0
4. **User-friendly**: Trải nghiệm đăng nhập mượt mà

Việc triển khai này đảm bảo ứng dụng có thể tương tác an toàn và hiệu quả với Spotify API, đồng thời cung cấp trải nghiệm người dùng tốt nhất. 