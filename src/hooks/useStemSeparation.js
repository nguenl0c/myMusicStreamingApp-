//../src/hooks/useStemSeparation.js
//upload và tách nhạc
import { useState, useEffect, useRef } from "react";
// import axios from "axios";

// API service (được tách ra ở chiến lược 2)
import {
    uploadAudio,
    startDemucs,
    getDemucsProgress,
} from "../services/mixerAPI";

export function useStemSeparation() {
    const [isSeparating, setIsSeparating] = useState(false);
    const [progressLog, setProgressLog] = useState("");
    const [error, setError] = useState(null);
    const [newlyCompletedTrack, setNewlyCompletedTrack] = useState(null);

    const [trackId, setTrackId] = useState(null);
    const progressInterval = useRef(null);

    // Effect để theo dõi tiến trình
    useEffect(() => {
        if (!trackId) return;

        const pollProgress = async () => {
            try {
                const res = await getDemucsProgress(trackId);

                if (res.data.error) {
                    throw new Error(res.data.error);
                }

                setProgressLog(res.data.log || "");

                if (res.data.done) {
                    clearInterval(progressInterval.current);
                    setIsSeparating(false);
                    setNewlyCompletedTrack({
                        trackId,
                        completedAt: new Date().toISOString(),
                    });
                    setTrackId(null); // Reset trackId
                }
            } catch (err) {
                console.error("Error fetching progress:", err);
                setError(`Lỗi khi theo dõi tiến trình: ${err.message}`);
                clearInterval(progressInterval.current);
                setIsSeparating(false);
            }
        };

        progressInterval.current = setInterval(pollProgress, 2000); // Poll every 2 seconds

        return () => clearInterval(progressInterval.current);
    }, [trackId]);

    // Hàm để component bên ngoài gọi để bắt đầu quá trình
    const startSeparation = async (file) => {
        if (!file) {
            setError("Vui lòng chọn một file.");
            return;
        }

        setIsSeparating(true);
        setError(null);
        setProgressLog("Bắt đầu upload file...");
        setNewlyCompletedTrack(null);

        try {
            const uploadRes = await uploadAudio(file);
            const newTrackId = uploadRes.data.trackId;

            setProgressLog("Upload thành công. Bắt đầu tách nhạc...");
            await startDemucs(newTrackId);

            setTrackId(newTrackId);
        } catch (err) {
            const errorMsg =
                err.response?.data?.error || err.message || "Tách nhạc thất bại.";
            console.error("Lỗi khi bắt đầu tách nhạc:", err);
            setError(errorMsg);
            setIsSeparating(false);
        }
    };

    return {
        isSeparating,
        progressLog,
        error,
        newlyCompletedTrack,
        startSeparation,
    };
}
