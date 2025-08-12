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
export const startDemucs = (trackId) => api.post('/start-demucs', { trackId });
export const getDemucsProgress = (trackId) => api.get(`/demucs-progress/${trackId}`);

// Mixing
export const mixStems = (stemPaths, songName) => api.post('/mix', { stemPaths, songName });
