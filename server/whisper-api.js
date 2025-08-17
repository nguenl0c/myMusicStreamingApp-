// server/whisper-api.js
import express from "express";
import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import process from "process";

/**
 * Tạo một router Express cho các tác vụ của Whisper.
 * @param {object} uploadedTracks - Object chứa thông tin các track đã upload.
 * @param {function} createUniqueDirectoryName - Hàm tiện ích để tạo tên thư mục.
 * @returns {express.Router}
 */
export default function createWhisperRouter(uploadedTracks, createUniqueDirectoryName) {
    const router = express.Router();
    const __dirname = path.resolve();
    const whisperProgress = {}; // Trạng thái của Whisper chỉ được quản lý ở đây

    /**
     * API: Bắt đầu quá trình trích xuất lời bài hát (transcribe).
     * ĐÃ ĐƯỢC CẬP NHẬT: Loại bỏ hoàn toàn logic cũ, chỉ sử dụng script karaoke.py.
     */
    router.post("/transcribe/:trackId", async (req, res) => {
        const { trackId } = req.params;
        const { language, model, stemFile } = (req.body || {});

        if (!trackId) {
            return res.status(400).json({ error: "Thiếu trackId." });
        }

        const pythonCmd = process.platform === "win32" ? "python" : "python3";
        const envDefaultModel = process.env.WHISPER_DEFAULT_MODEL;
        const requestedModel = (model || envDefaultModel || 'small').toLowerCase();
        const allowedModels = new Set(['large-v3', 'large-v2', 'medium', 'small', 'base', 'tiny', 'large-v3-turbo']);
        const chosenModel = allowedModels.has(requestedModel) ? requestedModel : 'small';
        const deviceOverride = process.env.WHISPER_DEVICE;
        const outputBaseDir = path.join(__dirname, "server", "output");
        if (!fs.existsSync(outputBaseDir)) fs.mkdirSync(outputBaseDir, { recursive: true });

        let sourceFilePath = null;
        let finalOutputDir = null;

        // Logic tìm file và thư mục (không thay đổi)
        if (uploadedTracks[trackId]) {
            const trackInfo = uploadedTracks[trackId];
            if (!trackInfo.songFolderName) {
                trackInfo.songFolderName = createUniqueDirectoryName(trackInfo.originalName, outputBaseDir);
            }
            finalOutputDir = path.join(outputBaseDir, trackInfo.songFolderName);
            if (!fs.existsSync(finalOutputDir)) fs.mkdirSync(finalOutputDir, { recursive: true });
            if (!stemFile) {
                return res.status(400).json({ error: "Vui lòng chọn stem để trích lời (thiếu stemFile)." });
            }
            if (/[\\/]/.test(stemFile) || stemFile.includes("..")) {
                return res.status(400).json({ error: "stemFile không hợp lệ." });
            }
            const candidate = path.join(finalOutputDir, stemFile);
            if (!fs.existsSync(candidate)) {
                return res.status(404).json({ error: `Không tìm thấy stem '${stemFile}'.` });
            }
            sourceFilePath = candidate;
        } else {
            const folderName = trackId;
            finalOutputDir = path.join(outputBaseDir, folderName);
            if (!fs.existsSync(finalOutputDir)) {
                return res.status(404).json({ error: "Folder bài hát không tồn tại." });
            }
            if (!stemFile) {
                return res.status(400).json({ error: "Vui lòng chọn stem để trích lời (thiếu stemFile)." });
            }
            if (/[\\/]/.test(stemFile) || stemFile.includes("..")) {
                return res.status(400).json({ error: "stemFile không hợp lệ." });
            }
            const candidate = path.join(finalOutputDir, stemFile);
            if (!fs.existsSync(candidate)) {
                return res.status(404).json({ error: `Không tìm thấy stem '${stemFile}'.` });
            }
            sourceFilePath = candidate;
        }

        // **THAY ĐỔI QUAN TRỌNG**: Xóa bỏ hoàn toàn khối if/else và luồng xử lý cũ.
        // Giờ đây, chúng ta luôn luôn gọi script karaoke.py.
        const scriptPath = path.join(__dirname, 'server', 'python', 'karaoke.py');
        const args = [
            scriptPath,
            '--input', sourceFilePath,
            '--output_dir', finalOutputDir,
            '--model', chosenModel,
            '--formats', 'json', // Luôn yêu cầu định dạng JSON
        ];
        if (language && language !== 'auto') args.push('--language', language);
        if (deviceOverride) args.push('--device', deviceOverride);

        console.log(`[Karaoke System] Running: ${pythonCmd} ${args.join(" ")}`);

        whisperProgress[trackId] = {
            status: 'starting', engine: 'stable-ts (karaoke.py)',
            model: chosenModel,
            language: language || 'auto',
            device: deviceOverride || 'auto',
            log: '', done: false, error: null, resultPaths: null,
            startedAt: Date.now(), updatedAt: Date.now(),
        };

        const child = spawn(pythonCmd, args, { windowsHide: true, env: { ...process.env, PYTHONIOENCODING: 'utf-8' } });

        // Logic xử lý output từ tiến trình con (không thay đổi)
        child.stdout.on('data', (data) => {
            const output = data.toString().trim();
            if (output.startsWith('{') && output.endsWith('}')) {
                try {
                    const parsed = JSON.parse(output);
                    console.log('[Karaoke System] Python script finished successfully:', parsed);
                    if (whisperProgress[trackId]) {
                        whisperProgress[trackId].resultPaths = parsed;
                    }
                } catch (e) {
                    console.error('Could not parse JSON from python stdout:', output);
                }
            } else {
                console.log('[python stdout]', output);
            }
        });

        child.stderr.on('data', (data) => {
            const logLine = data.toString();
            console.log('[python stderr]', logLine.trim());
            if (whisperProgress[trackId]) {
                whisperProgress[trackId].log += logLine;
                const lower = logLine.toLowerCase();
                if (lower.includes('download') && lower.includes('model')) {
                    whisperProgress[trackId].status = 'downloading';
                } else if (whisperProgress[trackId].status !== 'downloading') {
                    whisperProgress[trackId].status = 'processing';
                }
                whisperProgress[trackId].updatedAt = Date.now();
            }
        });

        child.on('close', (code) => {
            if (whisperProgress[trackId]) {
                whisperProgress[trackId].done = true;
                if (code !== 0) {
                    whisperProgress[trackId].status = 'error';
                    const log = (whisperProgress[trackId].log || '').toLowerCase();
                    if (log.includes('memoryerror') || log.includes('out of memory')) {
                        whisperProgress[trackId].error = `Whisper hết bộ nhớ khi tải model '${chosenModel}'. Hãy thử model nhỏ hơn.`;
                    } else {
                        whisperProgress[trackId].error = `Whisper thất bại (exit code: ${code}).`;
                    }
                } else {
                    whisperProgress[trackId].status = 'success';
                }
                whisperProgress[trackId].updatedAt = Date.now();
                whisperProgress[trackId].doneAt = Date.now();
            }
        });

        res.status(202).json({ message: "Bắt đầu trích xuất lời bài hát.", trackId });
    });

    // API lấy tiến trình (không đổi)
    router.get('/transcribe-progress/:trackId', (req, res) => {
        const { trackId } = req.params;
        const status = whisperProgress[trackId];
        if (!status) return res.json({ status: 'idle', done: false, log: '' });
        res.json(status);
    });

    // API lấy lời bài hát (không đổi, đã được đơn giản hóa ở phiên trước)
    router.get("/lyrics/:songFolderName", async (req, res) => {
        const { songFolderName } = req.params;
        const folder = path.join(__dirname, "server", "output", songFolderName);
        const jsonPath = path.join(folder, 'lyrics.json');

        if (fs.existsSync(jsonPath)) {
            res.setHeader('Content-Type', 'application/json');
            return res.sendFile(jsonPath);
        } else {
            return res.status(404).json({
                error: "Không tìm thấy file lời bài hát (lyrics.json).",
                message: "Vui lòng chạy lại chức năng 'Trích lời' cho bài hát này để tạo file lời chi tiết."
            });
        }
    });


    /**
     * API: Lấy về lời bài hát đã được trích xuất.
     * ĐÃ ĐƯỢC ĐƠN GIẢN HÓA: Chỉ tìm và trả về file `lyrics.json`.
     */
    router.get("/lyrics/:songFolderName", async (req, res) => {
        const { songFolderName } = req.params;
        const folder = path.join(__dirname, "server", "output", songFolderName);
        const jsonPath = path.join(folder, 'lyrics.json');

        if (fs.existsSync(jsonPath)) {
            res.setHeader('Content-Type', 'application/json');
            return res.sendFile(jsonPath);
        } else {
            return res.status(404).json({
                error: "Không tìm thấy file lời bài hát (lyrics.json).",
                message: "Vui lòng chạy lại chức năng 'Trích lời' cho bài hát này để tạo file lời chi tiết."
            });
        }
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
