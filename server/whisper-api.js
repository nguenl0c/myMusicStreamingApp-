// server/whisper-api.js
import express from "express";
import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import process from "process";

/**
 * Tạo một router Express cho các tác vụ của Whisper.
 * @param {object} uploadedTracks - Object chứa thông tin các track đã upload (được chia sẻ từ module khác).
 * @param {function} createUniqueDirectoryName - Hàm tiện ích để tạo tên thư mục.
 * @returns {express.Router}
 */
export default function createWhisperRouter(uploadedTracks, createUniqueDirectoryName) {
    const router = express.Router();
    const __dirname = path.resolve();
    const whisperProgress = {}; // Trạng thái của Whisper chỉ được quản lý ở đây

    /**
     * API: Bắt đầu quá trình trích xuất lời bài hát (transcribe).
     */
    router.post("/transcribe/:trackId", async (req, res) => {
        const { trackId } = req.params;
        const { language, model } = (req.body || {});

        if (!trackId) {
            return res.status(400).json({ error: "Thiếu trackId hoặc folderName." });
        }

    const pythonCmd = process.platform === "win32" ? "python" : "python3";
    // Cho phép override qua body hoặc biến môi trường, mặc định dùng model nhỏ để tránh thiếu bộ nhớ
    const envDefaultModel = process.env.WHISPER_DEFAULT_MODEL;
    const requestedModel = (model || envDefaultModel || 'small').toLowerCase();
    const allowedModels = new Set(['large-v3','large-v2','medium','small','base','tiny']);
    const chosenModel = allowedModels.has(requestedModel) ? requestedModel : 'small';
    const deviceOverride = process.env.WHISPER_DEVICE; // ví dụ: 'cpu' hoặc 'cuda'
        const outputBaseDir = path.join(__dirname, "server", "output");
        if (!fs.existsSync(outputBaseDir)) fs.mkdirSync(outputBaseDir, { recursive: true });

        let sourceFilePath = null;
        let finalOutputDir = null;

        if (uploadedTracks[trackId]) {
            // Trường hợp trackId là id đã upload
            const trackInfo = uploadedTracks[trackId];
            if (!trackInfo.songFolderName) {
                trackInfo.songFolderName = createUniqueDirectoryName(trackInfo.originalName, outputBaseDir);
            }
            finalOutputDir = path.join(outputBaseDir, trackInfo.songFolderName);
            if (!fs.existsSync(finalOutputDir)) fs.mkdirSync(finalOutputDir, { recursive: true });
            sourceFilePath = trackInfo.filePath;
        } else {
            // Trường hợp trackId chính là tên folder (songFolderName)
            const folderName = trackId;
            finalOutputDir = path.join(outputBaseDir, folderName);
            if (!fs.existsSync(finalOutputDir)) {
                return res.status(404).json({ error: "Folder bài hát không tồn tại." });
            }
            // Chọn file âm thanh tốt nhất để trích lời
            const preferred = [
                'vocals.mp3', 'no_vocals.mp3', 'other.mp3', 'bass.mp3', 'drums.mp3'
            ];
            const entries = fs.readdirSync(finalOutputDir);
            let candidate = preferred.find(name => entries.includes(name));
            if (!candidate) {
                candidate = entries.find(f => /\.(mp3|wav|m4a|flac)$/i.test(f));
            }
            if (!candidate) {
                return res.status(404).json({ error: "Không tìm thấy file âm thanh để trích lời trong thư mục." });
            }
            sourceFilePath = path.join(finalOutputDir, candidate);
        }

        const whisperArgs = [
            sourceFilePath,
            '--model', chosenModel,
            '--output_format', 'srt',
            '--output_dir', finalOutputDir,
        ];
        if (language && language !== 'auto') {
            whisperArgs.push('--language', language);
        }
        if (deviceOverride) {
            whisperArgs.push('--device', deviceOverride);
        }

        console.log(`[whisper] Running: ${pythonCmd} -m whisper ${whisperArgs.join(" ")}`);
        whisperProgress[trackId] = { status: 'starting', log: '', done: false, error: null };

        const child = spawn(pythonCmd, ['-m', 'whisper', ...whisperArgs], {
            windowsHide: true,
            env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
        });

        child.stderr.on('data', (data) => {
            const logLine = data.toString();
            console.log('[whisper stderr]', logLine.trim());
            whisperProgress[trackId].log += logLine;
            whisperProgress[trackId].status = 'processing';
        });

        child.on('close', (code) => {
            whisperProgress[trackId].done = true;
            if (code !== 0) {
                whisperProgress[trackId].status = 'error';
                const log = (whisperProgress[trackId].log || '').toLowerCase();
                if (log.includes('memoryerror') || log.includes('out of memory')) {
                    whisperProgress[trackId].error = `Whisper hết bộ nhớ khi tải model '${chosenModel}'. Hãy thử model nhỏ hơn (medium/small/base/tiny) hoặc đặt biến môi trường WHISPER_DEFAULT_MODEL=small. Nếu dùng GPU bị thiếu VRAM, có thể đặt WHISPER_DEVICE=cpu.`;
                } else {
                    whisperProgress[trackId].error = `Whisper thất bại (exit code: ${code}).`;
                }
            } else {
                whisperProgress[trackId].status = 'success';
            }
        });

        res.status(202).json({ message: "Bắt đầu trích xuất lời bài hát.", trackId });
    });

    // API: Lấy tiến trình trích xuất lời
    router.get('/transcribe-progress/:trackId', (req, res) => {
        const { trackId } = req.params;
        const status = whisperProgress[trackId];
        if (!status) return res.json({ status: 'idle', done: false, log: '' });
        res.json(status);
    });

    /**
     * API: Lấy về lời bài hát đã được trích xuất.
     */
    router.get("/lyrics/:songFolderName", async (req, res) => {
        const { songFolderName } = req.params;
        const folder = path.join(__dirname, "server", "output", songFolderName);
        if (!fs.existsSync(folder)) {
            return res.status(404).json({ error: "Folder bài hát không tồn tại." });
        }
        // Ưu tiên lyrics.srt, sau đó bất kỳ .srt nào
        const files = fs.readdirSync(folder);
        let srtFile = files.find(f => f.toLowerCase() === 'lyrics.srt');
        if (!srtFile) srtFile = files.find(f => /\.srt$/i.test(f));
        if (!srtFile) return res.status(404).json({ error: "Không tìm thấy file lời bài hát." });
        return res.sendFile(path.join(folder, srtFile));
    });

    /**
     * API: Lưu lời bài hát đã được người dùng chỉnh sửa.
     */
    router.post("/lyrics/:songFolderName", async (req, res) => {
        const { songFolderName } = req.params;
        const { lyricsContent } = (req.body || {});
        if (typeof lyricsContent !== 'string') {
            return res.status(400).json({ error: "Nội dung lời bài hát không hợp lệ." });
        }
        const folder = path.join(__dirname, "server", "output", songFolderName);
        if (!fs.existsSync(folder)) {
            return res.status(404).json({ error: "Folder bài hát không tồn tại." });
        }
        const srtPath = path.join(folder, 'lyrics.srt');
        try {
            fs.writeFileSync(srtPath, lyricsContent, 'utf8');
            res.json({ message: "Lưu lời bài hát thành công." });
        } catch (error) {
            console.error("Lỗi khi lưu file .srt:", error);
            res.status(500).json({ error: "Không thể lưu file lời bài hát." });
        }
    });

    return router;
}
