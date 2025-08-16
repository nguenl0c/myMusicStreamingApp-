import axios from 'axios';

const API_URL = 'http://localhost:5000/api';

// Tạo một instance của axios để có thể cấu hình chung
const api = axios.create({
    baseURL: API_URL,
});

// Stems
export const fetchStems = () => api.get('/stems');
export const deleteStemTrack = (trackId) => api.delete(`/stems/${trackId}`);

// Mixed Songs
export const fetchMixedSongs = () => api.get('/mixed-songs');
export const deleteMixedSong = (filename) => api.delete(`/mixed-songs/${encodeURIComponent(filename)}`);

// Separation Process
export const uploadAudio = (file) => {
    const formData = new FormData();
    formData.append('audio', file);
    return api.post('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    });
};
export const startDemucs = (trackId, options = {}) => {
    const payload = { trackId };
    const { model, twoStems, mp3Bitrate, mp3Preset } = options || {};
    if (model) payload.model = model; // e.g., 'htdemucs', 'mdx_q'
    if (twoStems) payload.twoStems = twoStems; // e.g., 'vocals' | 'drums' | 'bass' | 'other'
    if (mp3Bitrate) payload.mp3Bitrate = mp3Bitrate; // e.g., 192, 320
    if (mp3Preset) payload.mp3Preset = mp3Preset; // e.g., 2 (best) ... 7 (fastest)
    return api.post('/start-demucs', payload);
};
export const getDemucsProgress = (trackId) => api.get(`/demucs-progress/${trackId}`);

// Mixing
export const mixStems = (stemPaths, songName) => api.post('/mix', { stemPaths, songName });

// --- CÁC HÀM MỚI CHO WHISPER ---

/**
 * Bắt đầu quá trình trích xuất lời bài hát cho một track.
 * @param {string} trackId - ID của track.
 * @returns {Promise}
 */
export const startTranscription = (trackId) => {
    return api.post(`/transcribe/${trackId}`);
};

/**
 * Lấy nội dung file lời bài hát (.srt).
 * @param {string} songFolderName - Tên thư mục của bài hát.
 * @returns {Promise<string>} - Trả về nội dung của file srt dưới dạng text.
 */
export const fetchLyrics = async (songFolderName) => {
    const response = await api.get(`/lyrics/${encodeURIComponent(songFolderName)}`, {
        responseType: 'text' // Quan trọng: để nhận về dạng text thô
    });
    return response.data;
};

/**
 * Lưu lại nội dung lời bài hát đã được chỉnh sửa.
 * @param {string} songFolderName - Tên thư mục của bài hát.
 * @param {string} lyricsContent - Nội dung file .srt mới.
 * @returns {Promise}
 */
export const saveLyrics = (songFolderName, lyricsContent) => {
    return api.post(`/lyrics/${encodeURIComponent(songFolderName)}`, { lyricsContent });
};
