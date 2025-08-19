import axios from 'axios';

const API_URL = 'http://localhost:5000/api';
// Static files (lyrics, audio) are served outside of /api under /karaoke
const SERVER_URL = API_URL.replace(/\/?api$/, '');

/**
 * Gửi yêu cầu tạo một phiên karaoke mới.
 * @param {File} vocalTrack - File nhạc có lời.
 * @param {File} instrumentalTrack - File nhạc không lời.
 * @returns {Promise<string>} - Promise trả về jobId.
 */
export const createKaraokeSession = async (vocalTrack, instrumentalTrack) => {
  const formData = new FormData();
  formData.append('vocalTrack', vocalTrack);
  formData.append('instrumentalTrack', instrumentalTrack);

  const response = await axios.post(`${API_URL}/karaoke/create`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data.jobId; // Trả về jobId
};

/**
 * Lấy trạng thái của một công việc đang xử lý.
 * @param {string} jobId - ID của công việc.
 * @returns {Promise<object>} - Promise trả về đối tượng trạng thái.
 */
export const getKaraokeJobStatus = async (jobId) => {
  const response = await axios.get(`${API_URL}/karaoke/status/${jobId}`);
  return response.data;
};

/**
 * Lấy file lời bài hát đã được xử lý.
 * @param {string} sessionId - ID của phiên làm việc.
 * @returns {Promise<Array<object>>} - Promise trả về mảng lời bài hát.
 */
export const fetchKaraokeLyrics = async (sessionId) => {
  const response = await axios.get(`${SERVER_URL}/karaoke/${sessionId}/lyrics.json`);
  return response.data;
};

export const getKaraokeSessions = async () => {
  // Sessions endpoint is mounted under /api/karaoke
  const response = await axios.get(`${API_URL}/karaoke/sessions`);
  return response.data;
};

export const deleteKaraokeSession = async (sessionId) => {
  const response = await axios.delete(`${API_URL}/karaoke/sessions/${encodeURIComponent(sessionId)}`);
  return response.data;
};

export const renameKaraokeSession = async (sessionId, newName) => {
  const response = await axios.patch(`${API_URL}/karaoke/sessions/${encodeURIComponent(sessionId)}/rename`, { newName });
  return response.data; // { ok: true, sessionId: newName }
};

/**
 * Lưu lại lời bài hát đã chỉnh sửa cho một session.
 * @param {string} sessionId
 * @param {Array<object>} lyrics
 */
export const saveKaraokeLyrics = async (sessionId, lyrics) => {
  const response = await axios.patch(`${API_URL}/karaoke/sessions/${encodeURIComponent(sessionId)}/lyrics`, lyrics);
  return response.data; // { ok: true }
};