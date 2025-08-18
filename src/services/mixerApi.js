import axios from 'axios';

// API chỉ dành cho luồng Mixer/Stem tách nhạc
const API_URL = 'http://localhost:5000/api';
const api = axios.create({ baseURL: API_URL });

// Stems (Mixer)
export const fetchStems = () => api.get('/stems');
export const deleteStemTrack = (trackId) => api.delete(`/stems/${trackId}`);

// Mixed Songs (Mixer)
export const fetchMixedSongs = () => api.get('/mixed-songs');
export const deleteMixedSong = (filename) => api.delete(`/mixed-songs/${encodeURIComponent(filename)}`);

// Separation Process (Mixer)
export const uploadAudio = (file) => {
    const formData = new FormData();
    formData.append('audio', file);
    return api.post('/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
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

// Mixing (Mixer)
export const mixStems = (stemPaths, songName) => api.post('/mix', { stemPaths, songName });