//src/hooks/useStemPlayer.js
//Quản lý phát nhạc Stem
import { useState, useEffect, useRef, useCallback } from "react";

export function useStemPlayer() {
    const [selectedStems, setSelectedStems] = useState({});
    const [masterCurrentTime, setMasterCurrentTime] = useState(0);
    const [masterDuration, setMasterDuration] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);

    const audioRefs = useRef({});
    const progressInterval = useRef(null);

    const stopAllAudio = useCallback(() => {
        Object.values(audioRefs.current).forEach((audio) => {
            if (audio) {
                audio.pause();
                audio.currentTime = 0;
            }
        });
        setIsPlaying(false);
        if (progressInterval.current) {
            clearInterval(progressInterval.current);
        }
    }, []);

    const playAllSelected = () => {
        // Hàm này giữ nguyên cho các chức năng cũ
        const stemsToPlay = Object.values(selectedStems)
            .map((stem) => audioRefs.current[stem.key])
            .filter(Boolean);
        if (stemsToPlay.length === 0) return;

        stemsToPlay.forEach((audio) => {
            audio.currentTime = masterCurrentTime;
            audio.play().catch(console.error);
        });
        setIsPlaying(true);

        progressInterval.current = setInterval(() => {
            const referenceAudio = stemsToPlay[0];
            if (referenceAudio) {
                setMasterCurrentTime(referenceAudio.currentTime);
                if (referenceAudio.ended) {
                    stopAllAudio();
                    setMasterCurrentTime(0);
                }
            }
        }, 100);
    };

    // THÊM MỚI: Hàm chuyên dụng cho Karaoke
    // Chức năng: Tự động tải, chọn và phát tất cả các stem của một bài hát.
    const loadAndPlayAllStems = useCallback((stemsData) => {
        stopAllAudio(); // Dừng mọi thứ đang phát

    const newSelectedStems = {};
    const urls = Object.values(stemsData).map(stemInfo => stemInfo.url);

        // Tạo các audio element mới
        urls.forEach(url => {
            const key = url; // Dùng url làm key duy nhất
            // Bảo đảm URL tuyệt đối khi đang chạy trên Vite (5180)
            const fullUrl = /^https?:\/\//i.test(url) ? url : `http://localhost:5000${url}`;
            newSelectedStems[key] = { key, url: fullUrl };
            if (!audioRefs.current[key]) {
                const audio = new Audio(fullUrl);
                audioRefs.current[key] = audio;
            }
        });

        setSelectedStems(newSelectedStems);

        // Chờ một chút để các audio element được tạo và bắt đầu tải metadata
        setTimeout(() => {
            const audiosToPlay = Object.values(newSelectedStems).map(s => audioRefs.current[s.key]);

            // Đồng bộ và phát
            const playPromises = audiosToPlay.map(audio => audio.play());

            Promise.all(playPromises).then(() => {
                setIsPlaying(true);
                progressInterval.current = setInterval(() => {
                    const referenceAudio = audiosToPlay[0];
                    if (referenceAudio) {
                        setMasterCurrentTime(referenceAudio.currentTime);
                        const maxDuration = Math.max(...audiosToPlay.map(a => a.duration || 0));
                        setMasterDuration(maxDuration);
                        if (referenceAudio.ended) {
                            stopAllAudio();
                            setMasterCurrentTime(0);
                        }
                    }
                }, 100);
            }).catch(e => console.error("Lỗi khi phát audio:", e));
        }, 200); // Đợi 200ms

    }, [stopAllAudio]);

    // THÊM MỚI: Hàm cleanup để KaraokeView có thể gọi
    const cleanup = useCallback(() => {
        stopAllAudio();
        setSelectedStems({});
    }, [stopAllAudio]);


    const seekAll = (time) => {
        Object.values(audioRefs.current).forEach((audio) => {
            if (audio) audio.currentTime = time;
        });
        setMasterCurrentTime(time);
    };

    // useEffect này giữ nguyên
    useEffect(() => {
        const audioElements = Object.values(selectedStems)
            .map((stem) => audioRefs.current[stem.key])
            .filter(Boolean);
        if (audioElements.length > 0) {
            const firstAudio = audioElements[0];
            const setDur = () => {
                const maxDuration = Math.max(
                    ...audioElements.map((audio) => audio.duration || 0)
                );
                if (isFinite(maxDuration)) setMasterDuration(maxDuration);
            }
            if (firstAudio.readyState > 0) {
                setDur();
            } else {
                firstAudio.addEventListener('loadedmetadata', setDur);
            }
        } else {
            setMasterDuration(0);
        }
    }, [selectedStems]);

    const handleSelectStem = (song, stemType, url) => {
        stopAllAudio();
        const key = `${song.song}_${stemType}`;
        setSelectedStems((prev) => {
            const newSelected = { ...prev };
            if (newSelected[key]) {
                delete newSelected[key];
            } else {
                newSelected[key] = { key, song: song.song, type: stemType, url };
            }
            return newSelected;
        });
    };

    return {
        selectedStems,
        masterCurrentTime,
        masterDuration,
        isPlaying,
        audioRefs,
        handleSelectStem,
        playAllSelected,
        stopAllAudio,
        seekAll,
        // Trả về 2 hàm mới
        loadAndPlayAllStems,
        cleanup,
    };
}