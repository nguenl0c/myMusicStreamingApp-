// server/whisper-api.js
import express from "express";
import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import process from "process";
import multer from "multer";
import { v4 as uuidv4 } from "uuid";

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
    const pythonCmd = process.platform === "win32" ? "python" : "python3";

    // Upload handler cho karaoke luồng độc lập
    const upload = multer({ dest: path.join(__dirname, "server", "uploads") });
    const karaokeSessions = {}; // { [sessionId]: { status, log, done, error, resultPaths } }

    // API mới: Tạo phiên karaoke độc lập từ 2 file người dùng upload
    // POST /api/karaoke/create (multipart/form-data: vocalTrack, instrumentalTrack)
    router.post("/karaoke/create", upload.fields([
        { name: 'vocalTrack', maxCount: 1 },
        { name: 'instrumentalTrack', maxCount: 1 },
    ]), async (req, res) => {
        try {
            const vocalFile = req.files?.vocalTrack?.[0];
            const instrumentalFile = req.files?.instrumentalTrack?.[0];
            if (!vocalFile || !instrumentalFile) {
                return res.status(400).json({ error: "Thiếu file. Cần cả vocalTrack và instrumentalTrack." });
            }

            const sessionId = `karaoke_session_${uuidv4()}`;
            const sessionDir = path.join(__dirname, "server", "karaoke", sessionId);
            fs.mkdirSync(sessionDir, { recursive: true });

            // Đặt tên file đích cố định, giữ extension gốc nếu có
            const vocalExt = path.extname(vocalFile.originalname) || path.extname(vocalFile.filename) || '.mp3';
            const instrumentalExt = path.extname(instrumentalFile.originalname) || path.extname(instrumentalFile.filename) || '.mp3';
            const vocalDest = path.join(sessionDir, `vocals${vocalExt}`);
            const instrumentalDest = path.join(sessionDir, `instrumental${instrumentalExt}`);

            fs.renameSync(vocalFile.path, vocalDest);
            fs.renameSync(instrumentalFile.path, instrumentalDest);

            // Gọi script python để tạo lyrics.json
            const scriptPath = path.join(__dirname, 'server', 'python', 'karaoke.py');
            const args = [
                scriptPath,
                '--input', vocalDest,
                '--output_dir', sessionDir,
                '--model', (process.env.WHISPER_DEFAULT_MODEL || 'small').toLowerCase(),
                '--formats', 'json',
            ];
            if (process.env.WHISPER_DEVICE) {
                args.push('--device', process.env.WHISPER_DEVICE);
            }

            karaokeSessions[sessionId] = {
                status: 'starting', log: '', done: false, error: null,
                sessionId, resultPaths: null, startedAt: Date.now(), updatedAt: Date.now()
            };

            const child = spawn(pythonCmd, args, { windowsHide: true, env: { ...process.env, PYTHONIOENCODING: 'utf-8' } });
            child.stdout.on('data', (data) => {
                const output = data.toString().trim();
                if (output.startsWith('{') && output.endsWith('}')) {
                    try {
                        const parsed = JSON.parse(output);
                        karaokeSessions[sessionId].resultPaths = parsed?.files || null;
                    } catch {
                        // ignore
                    }
                }
            });
            child.stderr.on('data', (data) => {
                const line = data.toString();
                const sess = karaokeSessions[sessionId];
                if (sess) {
                    sess.log += line;
                    const lower = line.toLowerCase();
                    if (lower.includes('download') && lower.includes('model')) sess.status = 'downloading';
                    else if (sess.status !== 'downloading') sess.status = 'processing';
                    sess.updatedAt = Date.now();
                }
            });
            child.on('close', (code) => {
                const sess = karaokeSessions[sessionId];
                if (!sess) return;
                sess.done = true;
                sess.updatedAt = Date.now();
                sess.doneAt = Date.now();
                if (code !== 0) {
                    sess.status = 'error';
                    const logLower = (sess.log || '').toLowerCase();
                    if (logLower.includes('memoryerror') || logLower.includes('out of memory')) {
                        sess.error = 'Whisper hết bộ nhớ khi tải model. Hãy thử model nhỏ hơn.';
                    } else {
                        sess.error = `Xử lý karaoke thất bại (exit code: ${code})`;
                    }
                } else {
                    sess.status = 'success';
                }
            });

            const instrumentalUrl = `/karaoke/${encodeURIComponent(sessionId)}/${encodeURIComponent(path.basename(instrumentalDest))}`;
            return res.status(202).json({ sessionId, instrumentalUrl });
        } catch (err) {
            console.error('[karaoke/create] error:', err);
            return res.status(500).json({ error: 'Không thể tạo phiên karaoke', detail: err?.message });
        }
    });

    // API mới: Lấy trạng thái phiên karaoke
    router.get('/karaoke/status/:sessionId', (req, res) => {
        const { sessionId } = req.params;
        const s = karaokeSessions[sessionId];
        if (!s) return res.json({ status: 'unknown', done: false });
        res.json(s);
    });

    // Endpoint lấy lyrics cho karaoke session độc lập
    // GET /api/karaoke/lyrics/:sessionId -> trả file lyrics.json
    router.get('/karaoke/lyrics/:sessionId', async (req, res) => {
        const { sessionId } = req.params;
        const folder = path.join(__dirname, 'server', 'karaoke', sessionId);
        const jsonPath = path.join(folder, 'lyrics.json');
        if (fs.existsSync(jsonPath)) {
            res.setHeader('Content-Type', 'application/json');
            return res.sendFile(jsonPath);
        }
        return res.status(404).json({ error: 'Không tìm thấy lyrics.json cho session này.' });
    });

    // Liệt kê các phiên karaoke đã có
    router.get('/karaoke/sessions', async (req, res) => {
        try {
            const base = path.join(__dirname, 'server', 'karaoke');
            if (!fs.existsSync(base)) return res.json([]);
            const entries = fs.readdirSync(base, { withFileTypes: true });
            const audioRegex = /\.(mp3|wav|m4a|flac|aac|ogg)$/i;
            const sessions = [];
            for (const ent of entries) {
                if (!ent.isDirectory()) continue;
                const sessionId = ent.name;
                const dir = path.join(base, sessionId);
                const files = fs.readdirSync(dir);
                const lyricsExists = files.includes('lyrics.json');
                let instrumental = null; let vocals = null; let createdAt = null; let totalSize = 0;
                for (const f of files) {
                    const full = path.join(dir, f);
                    const st = fs.statSync(full);
                    totalSize += st.isFile() ? st.size : 0;
                    if (!createdAt || st.mtimeMs < createdAt) createdAt = st.mtimeMs;
                    if (audioRegex.test(f)) {
                        if (/^instrumental\./i.test(f)) {
                            instrumental = `/karaoke/${encodeURIComponent(sessionId)}/${encodeURIComponent(f)}`;
                        } else if (/^vocals?\./i.test(f)) {
                            vocals = `/karaoke/${encodeURIComponent(sessionId)}/${encodeURIComponent(f)}`;
                        }
                    }
                }
                sessions.push({
                    sessionId,
                    instrumentalUrl: instrumental,
                    vocalsUrl: vocals,
                    hasLyrics: lyricsExists,
                    createdAt: createdAt ? new Date(createdAt) : null,
                    totalSize,
                });
            }
            // mới nhất lên đầu
            sessions.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
            res.json(sessions);
        } catch (e) {
            console.error('[karaoke/sessions] error:', e);
            res.status(500).json({ error: 'Không thể liệt kê sessions', detail: e?.message });
        }
    });

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

    // đã khai báo pythonCmd phía trên
    const envDefaultModel = process.env.WHISPER_DEFAULT_MODEL;
    const requestedModel = (model || envDefaultModel || 'small').toLowerCase();
    const allowedModels = new Set(['large-v3', 'large-v2', 'medium', 'small', 'base', 'tiny', 'large-v3-turbo']);
    const chosenModel = allowedModels.has(requestedModel) ? requestedModel : 'small';
    const deviceOverride = process.env.WHISPER_DEVICE;
    // Mixer output base: chỉ dùng để tìm stem nguồn
    const outputBaseDir = path.join(__dirname, "server", "output");
    if (!fs.existsSync(outputBaseDir)) fs.mkdirSync(outputBaseDir, { recursive: true });
    // Karaoke base dir: nơi lưu lyrics.json riêng
    const karaokeBaseDir = path.join(__dirname, "server", "karaoke");
    if (!fs.existsSync(karaokeBaseDir)) fs.mkdirSync(karaokeBaseDir, { recursive: true });

        let sourceFilePath = null;
    let finalOutputDir = null; // thư mục stems của Mixer (chỉ để tìm file nguồn)
    let finalKaraokeDir = null; // thư mục lưu lyrics.json mới

        // Logic tìm file và thư mục (không thay đổi)
        if (uploadedTracks[trackId]) {
            const trackInfo = uploadedTracks[trackId];
            if (!trackInfo.songFolderName) {
                trackInfo.songFolderName = createUniqueDirectoryName(trackInfo.originalName, outputBaseDir);
            }
            finalOutputDir = path.join(outputBaseDir, trackInfo.songFolderName);
            if (!fs.existsSync(finalOutputDir)) fs.mkdirSync(finalOutputDir, { recursive: true });
            finalKaraokeDir = path.join(karaokeBaseDir, trackInfo.songFolderName);
            if (!fs.existsSync(finalKaraokeDir)) fs.mkdirSync(finalKaraokeDir, { recursive: true });
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
            finalKaraokeDir = path.join(karaokeBaseDir, folderName);
            if (!fs.existsSync(finalKaraokeDir)) fs.mkdirSync(finalKaraokeDir, { recursive: true });
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
            '--output_dir', finalKaraokeDir,
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
                    console.error('Could not parse JSON from python stdout:', output, e);
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
        // Ưu tiên lấy từ thư mục karaoke riêng
        let folder = path.join(__dirname, "server", "karaoke", songFolderName);
        let jsonPath = path.join(folder, 'lyrics.json');
        if (!fs.existsSync(jsonPath)) {
            // Fallback: tương thích cũ (nếu trước đây đã ghi vào output)
            folder = path.join(__dirname, "server", "output", songFolderName);
            jsonPath = path.join(folder, 'lyrics.json');
        }
        if (fs.existsSync(jsonPath)) {
            res.setHeader('Content-Type', 'application/json');
            return res.sendFile(jsonPath);
        }
        return res.status(404).json({
            error: "Không tìm thấy file lời bài hát (lyrics.json).",
            message: "Vui lòng chạy lại chức năng 'Trích lời' cho bài hát này để tạo file lời chi tiết."
        });
    });


    /**
     * API: Lấy về lời bài hát đã được trích xuất.
     * ĐÃ ĐƯỢC ĐƠN GIẢN HÓA: Chỉ tìm và trả về file `lyrics.json`.
     */
    router.get("/lyrics/:songFolderName", async (req, res) => {
        const { songFolderName } = req.params;
        let folder = path.join(__dirname, "server", "karaoke", songFolderName);
        let jsonPath = path.join(folder, 'lyrics.json');
        if (!fs.existsSync(jsonPath)) {
            folder = path.join(__dirname, "server", "output", songFolderName);
            jsonPath = path.join(folder, 'lyrics.json');
        }
        if (fs.existsSync(jsonPath)) {
            res.setHeader('Content-Type', 'application/json');
            return res.sendFile(jsonPath);
        }
        return res.status(404).json({
            error: "Không tìm thấy file lời bài hát (lyrics.json).",
            message: "Vui lòng chạy lại chức năng 'Trích lời' cho bài hát này để tạo file lời chi tiết."
        });
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
