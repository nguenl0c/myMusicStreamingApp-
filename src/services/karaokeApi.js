import axios from 'axios';

// Karaoke APIs (tách riêng khỏi luồng Mixer)
const API_URL = 'http://localhost:5000/api';
const api = axios.create({ baseURL: API_URL });

// Lấy lyrics cho sessionId (luồng mới) hoặc tên thư mục bài hát (fallback luồng cũ)
export const fetchLyrics = async (idOrName) => {
  if (!idOrName) throw new Error('Thiếu sessionId hoặc tên bài hát');
  try {
    const res = await api.get(`/karaoke/lyrics/${encodeURIComponent(idOrName)}`);
    const data = res.data;
    return Array.isArray(data) ? data : (Array.isArray(data?.lyrics) ? data.lyrics : []);
  } catch (errNew) {
    try {
      const res = await api.get(`/lyrics/${encodeURIComponent(idOrName)}`);
      const data = res.data;
      return Array.isArray(data) ? data : (Array.isArray(data?.lyrics) ? data.lyrics : []);
    } catch (errOld) {
      const msg = errNew?.response?.data?.message || errOld?.response?.data?.message || 'Không thể tải lyrics';
      const status = errNew?.response?.status || errOld?.response?.status;
      const e = new Error(msg);
      e.status = status;
      throw e;
    }
  }
};

export default {
  fetchLyrics,
};
