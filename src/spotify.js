// spotify.js
import axios from 'axios';

const BACKEND_URL = 'http://localhost:5000';
const TOKEN_KEY = 'spotify_access_token'; // Key chính cho token
const REFRESH_TOKEN_KEY = 'spotify_refresh_token';
const EXPIRES_AT_KEY = 'spotify_expires_at';
const RETRY_DELAY = 1000; // Thời gian chờ (ms) trước khi thử lại yêu cầu
const MAX_RETRIES = 3; // Số lần thử lại tối đa

// Biến toàn cục để kiểm soát việc refresh token
let isRefreshing = false;
let refreshPromise = null;
let failedRequests = [];

export const authScope = 'user-read-private user-read-email user-library-read user-library-modify playlist-read-private playlist-modify-public playlist-modify-private streaming user-read-playback-state user-modify-playback-state';

// Lưu tokens vào localStorage - hàm chính để lưu token
export const saveTokensToStorage = (data) => {
  if (!data || !data.access_token) return;
  
  localStorage.setItem(TOKEN_KEY, data.access_token);
  localStorage.setItem('token', data.access_token); // Cho tương thích ngược
  
  if (data.refresh_token) {
    localStorage.setItem(REFRESH_TOKEN_KEY, data.refresh_token);
  }
  
  if (data.expires_in) {
    // Giảm thời gian hết hạn xuống 1 phút để đảm bảo an toàn
    const expiresAt = Date.now() + (data.expires_in - 60) * 1000;
    localStorage.setItem(EXPIRES_AT_KEY, expiresAt);
  }
  
  localStorage.setItem('isLoggedIn', 'true');
  
  console.log('Tokens saved to storage');
};

// Set token cho các yêu cầu API
export const setClientToken = (token) => {
  if (!token) return;
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem('token', token); // Cho tương thích ngược
};

// Lấy access token từ localStorage
export const getAccessToken = () => {
  const token = localStorage.getItem(TOKEN_KEY) || localStorage.getItem('token');
  return token;
};

// Kiểm tra xem token đã hết hạn chưa
export const isTokenExpired = () => {
  const expiresAt = localStorage.getItem(EXPIRES_AT_KEY);
  return !expiresAt || Date.now() > Number(expiresAt);
};

// Xoá tất cả token
export const clearAllTokens = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem('token');
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(EXPIRES_AT_KEY);
  localStorage.removeItem('isLoggedIn');
};

// Làm mới token khi hết hạn
export const refreshToken = async () => {
  const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);

  if (!refreshToken) {
    console.error("No refresh token available");
    clearAllTokens(); // Xóa hết token không hợp lệ
    return null;
  }

  // Nếu đang có quá trình refresh, trả về promise đó
  if (isRefreshing) {
    return refreshPromise;
  }

  // Thiết lập quá trình refresh mới
  isRefreshing = true;

  refreshPromise = new Promise((resolve, reject) => {
    // SỬA LỖI: Định nghĩa hàm doRefresh để nhận token làm tham số
    const doRefresh = async (tokenToRefresh) => {
      try {
        console.log("Refreshing Spotify token...");
        const response = await axios.post(`${BACKEND_URL}/auth/refresh_token`, {
          // Sử dụng tham số được truyền vào
          refresh_token: tokenToRefresh,
        });

        const { access_token, expires_in } = response.data;
        if (!access_token)
          throw new Error("No access token in refresh response");

        localStorage.setItem(TOKEN_KEY, access_token);
        const expiresAt = Date.now() + (expires_in - 60) * 1000;
        localStorage.setItem(EXPIRES_AT_KEY, expiresAt);

        console.log("Token refreshed successfully");

        failedRequests.forEach((req) => req.resolve(access_token));
        failedRequests = [];

        resolve(access_token);
      } catch (error) {
        console.error(
          "Error refreshing token:",
          error?.response?.data || error.message
        );
        failedRequests.forEach((req) => req.reject(error));
        failedRequests = [];
        if (
          error?.response?.status === 401 ||
          error?.response?.status === 403
        ) {
          console.error("Refresh token may be invalid, clearing all tokens");
          clearAllTokens();
        }
        reject(error);
      } finally {
        isRefreshing = false;
        refreshPromise = null;
      }
    };

    // Gọi hàm async và truyền refreshTokenValue vào
    doRefresh(refreshToken);
  });

  return refreshPromise;
};

// Xử lý callback và lấy token
export const handleCallback = async (code) => {
  try {
    console.log('Handling callback with code:', code.substring(0, 10) + '...');
    const response = await axios.post(`${BACKEND_URL}/auth/token`, { code });
    console.log('Token response received');
    saveTokensToStorage(response.data);
    return response.data;
  } catch (error) {
    console.error('Error getting token:', error?.response?.data || error.message);
    return null;
  }
};

// Lấy token đảm bảo còn hạn với retry trong trường hợp lỗi
export const getValidToken = async (retryCount = 0) => {
  try {
    if (isTokenExpired()) {
      console.log('Token expired, refreshing...');
      const newToken = await refreshToken();
      if (!newToken) {
        throw new Error('Failed to refresh token');
      }
      return newToken;
    }
    
    const token = getAccessToken();
    if (!token) {
      throw new Error('No access token available');
    }
    
    return token;
  } catch (error) {
    console.error('Error in getValidToken:', error.message);
    
    // Retry logic - thử lại nếu chưa vượt quá số lần thử
    if (retryCount < MAX_RETRIES) {
      console.log(`Retrying getValidToken (${retryCount + 1}/${MAX_RETRIES})...`);
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
      return getValidToken(retryCount + 1);
    }
    
    // Nếu đã thử hết số lần, trả về null
    return null;
  }
};

// Tạo một wrapper cho bất kỳ request Spotify API nào
// Tự động xử lý việc refresh token và retry nếu cần
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
    // Xử lý lỗi 401 (Unauthorized) - có thể token hết hạn
    if (error?.response?.status === 401 && retryCount < MAX_RETRIES) {
      console.log('Got 401 error, refreshing token and retrying...');
      
      // Xóa token hiện tại để buộc refresh
      localStorage.removeItem(EXPIRES_AT_KEY);
      
      // Thử lại sau khi refresh token
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
      return callSpotifyAPI(method, endpoint, options, retryCount + 1);
    }
    
    // Xử lý lỗi 429 (Too Many Requests) - Rate limiting
    if (error?.response?.status === 429 && retryCount < MAX_RETRIES) {
      const retryAfter = error.response.headers['retry-after'] || 2;
      console.log(`Rate limited, retrying after ${retryAfter} seconds...`);
      
      await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
      return callSpotifyAPI(method, endpoint, options, retryCount + 1);
    }
    
    // Xử lý lỗi 500/502/503 - Server error
    if (error?.response?.status >= 500 && error?.response?.status < 600 && retryCount < MAX_RETRIES) {
      console.log(`Server error ${error.response.status}, retrying...`);
      
      const backoffTime = RETRY_DELAY * Math.pow(2, retryCount);
      await new Promise(resolve => setTimeout(resolve, backoffTime));
      return callSpotifyAPI(method, endpoint, options, retryCount + 1);
    }
    
    // Nếu không phải lỗi có thể xử lý, ném ra để caller xử lý
    throw error;
  }
};

export const getUserProfile = async () => {
  try {
    return await callSpotifyAPI('get', '/me');
  } catch (error) {
    console.error('Error fetching user profile:', error?.response?.data || error.message);
    return null;
  }
};

export const getAPIKit = () => {
  return axios.create({
    baseURL: "https://api.spotify.com/v1",
    headers: {
      Authorization: `Bearer ${getAccessToken()}`
    }
  });
};
export const spotifyApi = {
  request: async (config) => {
    // Lấy token từ localStorage
    const token = getAccessToken();
    
    if (!token) {
      throw new Error('Không có token xác thực. Vui lòng đăng nhập lại.');
    }
    
    // Thêm token vào header Authorization
    const requestConfig = {
      ...config,
      headers: {
        ...config.headers,
        'Authorization': `Bearer ${token}`
      }
    };
    
    try {
      // Thực hiện request
      const response = await axios(requestConfig);
      return response.data;
    } catch (error) {
      // Kiểm tra nếu token hết hạn (401)
      if (error.response && error.response.status === 401) {
        console.log('Token hết hạn, thử làm mới token');
        
        // Thử làm mới token (nếu bạn có implement phần này)
        // const newToken = await refreshAccessToken();
        // if (newToken) {
        //   // Thử lại với token mới
        //   requestConfig.headers['Authorization'] = `Bearer ${newToken}`;
        //   const retryResponse = await axios(requestConfig);
        //   return retryResponse.data;
        // }
      }
      
      // Nếu không phải lỗi token hoặc không thể làm mới token, throw lỗi
      throw error;
    }
  },
  
  // Các phương thức tiện ích
  getTrack: async (trackId) => {
    return spotifyApi.request({
      method: 'GET',
      url: `https://api.spotify.com/v1/tracks/${trackId}`
    });
  },
  
  searchTracks: async (query, limit = 10) => {
    return spotifyApi.request({
      method: 'GET',
      url: 'https://api.spotify.com/v1/search',
      params: {
        q: query,
        type: 'track',
        limit
      }
    });
  },
  
  getPlaylist: async (playlistId) => {
    return spotifyApi.request({
      method: 'GET',
      url: `https://api.spotify.com/v1/playlists/${playlistId}`
    });
  }
};
