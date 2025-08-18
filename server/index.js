import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import axios from 'axios';
import querystring from 'querystring';
import process from 'process';
import { Buffer } from 'buffer';
import path from 'path';
import demucsApiRouter, { uploadedTracks, createUniqueDirectoryName } from './demucs-api.js';
import createKaraokeRouter from './whisper-api.js';

dotenv.config({path: '.env'});
console.log('Environment variables loaded:');
console.log(`SPOTIFY_CLIENT_ID: ${process.env.SPOTIFY_CLIENT_ID ? 'Defined' : 'MISSING'}`);
console.log(`SPOTIFY_CLIENT_SECRET: ${process.env.SPOTIFY_CLIENT_SECRET ? 'Defined' : 'MISSING'}`);
console.log(`REDIRECT_URI: ${process.env.REDIRECT_URI ? process.env.REDIRECT_URI : 'MISSING'}`);

const app = express();
const port = 5000;

app.use(cors({
    origin: [ 'http://localhost:5180'], // Bao gồm các port có thể dùng
    methods: ['GET', 'POST', 'DELETE'],
    credentials: true
  }));
app.use(express.json());

// Mount demucs API router
app.use('/api', demucsApiRouter);
// Mount whisper API router (lyrics extraction/karaoke)
app.use('/api/karaoke', createKaraokeRouter());

// Serve static files for output
const __dirname = path.resolve();
app.use('/output', express.static(path.join(__dirname, 'server', 'output')));
app.use('/stems', express.static(path.join(__dirname, 'server', 'output')));
app.use('/mixed', express.static(path.join(__dirname, 'server', 'output')));
app.use('/mixer', express.static(path.join(__dirname, 'server', 'mixer')));
// Static route riêng cho karaoke sessions
app.use('/karaoke', express.static(path.join(__dirname, 'server', 'karaoke')));

// Tạo chuỗi ngẫu nhiên cho state
const generateRandomString = (length) => {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

  for (let i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
};

app.post('/auth/token', async (req, res) => {
  const code = req.body.code || null;
  console.log('Code nhận được từ frontend:', code);
  console.log('Redirect URI gửi lên Spotify:', process.env.REDIRECT_URI);

  if (!code) {
    return res.status(400).json({ error: 'Code is required' });
  }

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
    console.error('Error getting token:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to get token', detail: error.response?.data || error.message });
  }
});

// Endpoint để redirect người dùng đến trang xác thực Spotify
app.get('/auth/login', (req, res) => {
  const state = generateRandomString(16);
  // Yêu cầu tất cả các scope cần thiết cho Web Playback SDK và các tính năng khác
  const scope = [
    // Playback control
    'streaming',
    'app-remote-control',
    
    // Playback state
    'user-read-playback-state',
    'user-modify-playback-state',
    'user-read-currently-playing',
    
    // Library access
    'user-library-read',
    'user-library-modify',
    
    // Playlist access
    'playlist-read-private',
    'playlist-read-collaborative',
    'playlist-modify-public',
    'playlist-modify-private',
    
    // User data
    'user-read-email',
    'user-read-private',
    'user-read-recently-played',
    'user-top-read',
    'user-follow-read',
    'user-follow-modify'
  ].join(' ');

  console.log('Redirecting to Spotify login with these scopes:', scope);

  res.redirect('https://accounts.spotify.com/authorize?' +
    querystring.stringify({
      response_type: 'code',
      client_id: process.env.SPOTIFY_CLIENT_ID,
      scope: scope,
      redirect_uri: process.env.REDIRECT_URI,
      state: state,
      show_dialog: true // Hiển thị dialog xác thực mỗi lần để người dùng có thể chọn tài khoản
    })
  );
});

// Endpoint để làm mới token
app.post('/auth/refresh_token', async (req, res) => {
  const refreshToken = req.body.refresh_token || null;

  if (!refreshToken) {
    return res.status(400).json({ error: 'Refresh token is required' });
  }

  try {
    const response = await axios({
      method: 'post',
      url: 'https://accounts.spotify.com/api/token',
      data: querystring.stringify({
        refresh_token: refreshToken,
        grant_type: 'refresh_token'
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
    console.error('Error refreshing token:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to refresh token' });
  }
});

// Endpoint để kiểm tra tình trạng Premium
app.get('/auth/check-premium', async (req, res) => {
  const token = req.headers.authorization?.split('Bearer ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  try {
    console.log('Đang kiểm tra trạng thái Premium...');
    const response = await axios.get('https://api.spotify.com/v1/me', {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    const isPremium = response.data.product === 'premium';
    console.log(`Người dùng ${response.data.display_name} có tài khoản ${isPremium ? 'Premium' : 'Free'}`);
    
    res.json({
      isPremium,
      user: {
        id: response.data.id,
        name: response.data.display_name,
        email: response.data.email,
        image: response.data.images && response.data.images.length > 0 ? response.data.images[0].url : null,
        product: response.data.product
      }
    });
  } catch (error) {
    console.error('Error checking premium status:', error.response?.data || error.message);
    
    // Trả về lỗi chi tiết hơn
    if (error.response) {
      return res.status(error.response.status).json({ 
        error: 'Lỗi API Spotify', 
        details: error.response.data
      });
    }
    
    res.status(500).json({ error: 'Không thể kết nối với Spotify API' });
  }
});

const server = app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
  console.log(`Ensure Spotify app is registered with redirect URI: ${process.env.REDIRECT_URI}`);
});

// Keep the server running
server.keepAliveTimeout = 0;
server.timeout = 0;