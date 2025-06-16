// src/components/audioPlayer/spotifyHelper.js
import axios from 'axios';

/**
 * Phát một track Spotify trên device cụ thể
 * @param {string} token - Spotify access token
 * @param {string} deviceId - ID của device Spotify
 * @param {string} trackUri - URI của track cần phát
 * @param {number} position_ms - Vị trí bắt đầu (milliseconds)
 * @returns {Promise<boolean>} - true nếu thành công
 */
export const playSpotifyTrack = async (token, deviceId, trackUri, position_ms = 0) => {
  if (!token || !deviceId || !trackUri) {
    console.error('Missing parameters for playSpotifyTrack:', { token: !!token, deviceId, trackUri });
    return false;
  }

  try {    console.log('Playing Spotify track:', { trackUri, deviceId, position_ms });
    
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

    console.log('Spotify play request successful');
    return true;
  } catch (error) {
    console.error('Error playing Spotify track:', error.response?.data || error.message);
    return false;
  }
};

/**
 * Tạm dừng phát nhạc Spotify
 * @param {string} token - Spotify access token
 * @returns {Promise<boolean>} - true nếu thành công
 */
export const pauseSpotifyTrack = async (token) => {
  if (!token) {
    console.error('Missing token for pauseSpotifyTrack');
    return false;
  }

  try {
    console.log('Pausing Spotify track');
    
    await axios.put(
      'https://api.spotify.com/v1/me/player/pause',
      {},
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('Spotify pause request successful');
    return true;
  } catch (error) {
    console.error('Error pausing Spotify track:', error.response?.data || error.message);
    return false;
  }
};

/**
 * Tua đến vị trí cụ thể trong track Spotify
 * @param {string} token - Spotify access token
 * @param {number} position_ms - Vị trí cần tua đến (milliseconds)
 * @returns {Promise<boolean>} - true nếu thành công
 */
export const seekSpotifyTrack = async (token, position_ms) => {
  if (!token || position_ms < 0) {
    console.error('Invalid parameters for seekSpotifyTrack:', { token: !!token, position_ms });
    return false;
  }

  try {
    console.log('Seeking Spotify track to position:', position_ms);
    
    await axios.put(
      'https://api.spotify.com/v1/me/player/seek',
      null,
      {
        params: {
          position_ms: Math.round(position_ms)
        },
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('Spotify seek request successful');
    return true;
  } catch (error) {
    console.error('Error seeking Spotify track:', error.response?.data || error.message);
    return false;
  }
};

/**
 * Lấy thông tin trạng thái phát hiện tại từ Spotify
 * @param {string} token - Spotify access token
 * @returns {Promise<object|null>} - Thông tin trạng thái hoặc null
 */
export const getCurrentPlaybackState = async (token) => {
  if (!token) {
    console.error('Missing token for getCurrentPlaybackState');
    return null;
  }

  try {
    const response = await axios.get(
      'https://api.spotify.com/v1/me/player/currently-playing',
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );

    return response.data || null;
  } catch (error) {
    console.error('Error getting current playback state:', error.response?.data || error.message);
    return null;
  }
};

/**
 * Lấy danh sách devices khả dụng
 * @param {string} token - Spotify access token
 * @returns {Promise<Array>} - Danh sách devices
 */
export const getAvailableDevices = async (token) => {
  if (!token) {
    console.error('Missing token for getAvailableDevices');
    return [];
  }

  try {
    const response = await axios.get(
      'https://api.spotify.com/v1/me/player/devices',
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );

    return response.data?.devices || [];
  } catch (error) {
    console.error('Error getting available devices:', error.response?.data || error.message);
    return [];
  }
};

/**
 * Chuyển phát nhạc sang device khác
 * @param {string} token - Spotify access token
 * @param {string} deviceId - ID của device đích
 * @param {boolean} play - Có phát nhạc ngay lập tức không
 * @returns {Promise<boolean>} - true nếu thành công
 */
export const transferPlayback = async (token, deviceId, play = false) => {
  if (!token || !deviceId) {
    console.error('Missing parameters for transferPlayback:', { token: !!token, deviceId });
    return false;
  }

  try {    console.log('Transferring playback to device:', deviceId);
    
    await axios.put(
      'https://api.spotify.com/v1/me/player',
      {
        device_ids: [deviceId],
        play: play
      },
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('Playback transfer successful');
    return true;
  } catch (error) {
    console.error('Error transferring playback:', error.response?.data || error.message);
    return false;
  }
};
