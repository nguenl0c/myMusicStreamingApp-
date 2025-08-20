//../src/hooks/useStemSeparation.js
//upload và tách nhạc
import { useState, useEffect, useRef } from 'react';
import { uploadAudio, startDemucs, getDemucsProgress } from '../services/mixerApi.js';

export function useStemSeparation() {
    const [isSeparating, setIsSeparating] = useState(false);
    const [_progressLog, setProgressLog] = useState('');
    const [percent, setPercent] = useState(0); // <-- State mới để lưu phần trăm
    const [statusText, setStatusText] = useState(''); // <-- State mới cho thông điệp trạng thái
    const [error, setError] = useState(null);
    const [newlyCompletedTrack, setNewlyCompletedTrack] = useState(null);

    const [trackId, setTrackId] = useState(null);
    const progressInterval = useRef(null);

    useEffect(() => {
        if (!trackId) return;

        const pollProgress = async () => {
            try {
                const res = await getDemucsProgress(trackId);

                if (res.data.error) throw new Error(res.data.error);

                // Cập nhật state mới
                setPercent(res.data.percent || 0);
                setProgressLog(res.data.log || '');

                // Cập nhật thông điệp trạng thái dựa trên tiến trình
                if (res.data.percent < 10) setStatusText('Đang khởi tạo...');
                else if (res.data.percent < 95) setStatusText('Đang phân tích và xử lý...');
                else setStatusText('Đang hoàn tất...');

                if (res.data.done) {
                    clearInterval(progressInterval.current);
                    setPercent(100);
                    setStatusText('Hoàn thành!');
                    setIsSeparating(false);
                    setNewlyCompletedTrack({ trackId, completedAt: new Date().toISOString() });
                    setTrackId(null);
                }
            } catch (err) {
                console.error('Error fetching progress:', err);
                setError(`Lỗi khi theo dõi tiến trình: ${err.message}`);
                clearInterval(progressInterval.current);
                setIsSeparating(false);
            }
        };

        progressInterval.current = setInterval(pollProgress, 2000);

        return () => clearInterval(progressInterval.current);
    }, [trackId]);

    const startSeparation = async (file, options = {}) => {
        if (!file) {
            setError('Vui lòng chọn một file.');
            return;
        }

        setIsSeparating(true);
        setError(null);
        setPercent(0);
        setStatusText('Đang tải file lên máy chủ...');
        setNewlyCompletedTrack(null);

        try {
            const uploadRes = await uploadAudio(file);
            const newTrackId = uploadRes.data.trackId;

            setStatusText('Upload thành công. Bắt đầu tách nhạc...');
            await startDemucs(newTrackId, options);

            setTrackId(newTrackId);
        } catch (err) {
            const errorMsg = err.response?.data?.error || err.message || 'Tách nhạc thất bại.';
            console.error('Lỗi khi bắt đầu tách nhạc:', err);
            setError(errorMsg);
            setIsSeparating(false);
        }
    };

    return {
        isSeparating,
        percent, // <-- Trả về percent
        statusText, // <-- Trả về statusText
        error,
        newlyCompletedTrack,
    startSeparation
    };
}
