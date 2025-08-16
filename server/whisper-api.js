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
        const { language, model, engine, stemFile } = (req.body || {});

        if (!trackId) {
            return res.status(400).json({ error: "Thiếu trackId hoặc folderName." });
        }

        const pythonCmd = process.platform === "win32" ? "python" : "python3";
        const envDefaultModel = process.env.WHISPER_DEFAULT_MODEL;
        const requestedModel = (model || envDefaultModel || 'small').toLowerCase();
        const allowedModels = new Set(['large-v3','large-v2','medium','small','base','tiny','large-v3-turbo']);
        const chosenModel = allowedModels.has(requestedModel) ? requestedModel : 'small';
        const deviceOverride = process.env.WHISPER_DEVICE; // ví dụ: 'cpu' hoặc 'cuda'
        const outputBaseDir = path.join(__dirname, "server", "output");
        if (!fs.existsSync(outputBaseDir)) fs.mkdirSync(outputBaseDir, { recursive: true });

    let sourceFilePath = null;
    let finalOutputDir = null;

        if (uploadedTracks[trackId]) {
            const trackInfo = uploadedTracks[trackId];
            if (!trackInfo.songFolderName) {
                trackInfo.songFolderName = createUniqueDirectoryName(trackInfo.originalName, outputBaseDir);
            }
            finalOutputDir = path.join(outputBaseDir, trackInfo.songFolderName);
            if (!fs.existsSync(finalOutputDir)) fs.mkdirSync(finalOutputDir, { recursive: true });
            // Bắt buộc phải có stemFile, không còn tự động chọn
            if (!stemFile) {
                return res.status(400).json({ error: "Vui lòng chọn stem để trích lời (thiếu stemFile)." });
            }
            // Chặn path traversal
            if (/[\\/]/.test(stemFile) || stemFile.includes("..")) {
                return res.status(400).json({ error: "stemFile không hợp lệ." });
            }
            const candidate = path.join(finalOutputDir, stemFile);
            if (!fs.existsSync(candidate)) {
                return res.status(404).json({ error: `Không tìm thấy stem '${stemFile}' trong thư mục bài hát.` });
            }
            sourceFilePath = candidate;
        } else {
            const folderName = trackId;
            finalOutputDir = path.join(outputBaseDir, folderName);
            if (!fs.existsSync(finalOutputDir)) {
                return res.status(404).json({ error: "Folder bài hát không tồn tại." });
            }
            // YÊU CẦU: bắt buộc người dùng chọn stem, không tự động chọn
            if (!stemFile) {
                return res.status(400).json({ error: "Vui lòng chọn stem để trích lời (thiếu stemFile)." });
            }
            // Chặn path traversal
            if (/[\\/]/.test(stemFile) || stemFile.includes("..")) {
                return res.status(400).json({ error: "stemFile không hợp lệ." });
            }
            const candidate = path.join(finalOutputDir, stemFile);
            if (!fs.existsSync(candidate)) {
                return res.status(404).json({ error: `Không tìm thấy stem '${stemFile}' trong thư mục bài hát.` });
            }
            sourceFilePath = candidate;
        }

        const useStableTs = (typeof engine === 'string' && engine.toLowerCase() === 'stable') || requestedModel.includes('turbo');

        let child;
        if (useStableTs) {
            const scriptPath = path.join(__dirname, 'server', 'python', 'karaoke.py');
            const args = [
                scriptPath,
                '--input', sourceFilePath,
                '--output_dir', finalOutputDir,
                '--model', chosenModel,
                '--formats', 'srt',
            ];
            if (language && language !== 'auto') args.push('--language', language);
            if (deviceOverride) args.push('--device', deviceOverride);
            console.log(`[stable-ts] Running: ${pythonCmd} ${args.join(" ")}`);
            whisperProgress[trackId] = {
                status: 'starting', engine: 'stable-ts',
                model: chosenModel,
                language: language || 'auto',
                device: deviceOverride || 'auto',
                log: '', done: false, error: null,
                startedAt: Date.now(), updatedAt: Date.now(),
            };
            child = spawn(pythonCmd, args, { windowsHide: true, env: { ...process.env, PYTHONIOENCODING: 'utf-8' } });
        } else {
            const whisperArgs = [
                sourceFilePath,
                '--model', chosenModel,
                '--output_format', 'srt',
                '--output_dir', finalOutputDir,
            ];
            if (language && language !== 'auto') whisperArgs.push('--language', language);
            if (deviceOverride) whisperArgs.push('--device', deviceOverride);
            console.log(`[whisper] Running: ${pythonCmd} -m whisper ${whisperArgs.join(" ")}`);
            whisperProgress[trackId] = {
                status: 'starting', engine: 'whisper-cli',
                model: chosenModel,
                language: language || 'auto',
                device: deviceOverride || 'auto',
                log: '', done: false, error: null,
                startedAt: Date.now(), updatedAt: Date.now(),
            };
            child = spawn(pythonCmd, ['-m', 'whisper', ...whisperArgs], { windowsHide: true, env: { ...process.env, PYTHONIOENCODING: 'utf-8' } });
        }

        child.stderr.on('data', (data) => {
            const logLine = data.toString();
            console.log('[whisper stderr]', logLine.trim());
            whisperProgress[trackId].log += logLine;
            // Heuristic: nếu log chứa download thì coi là đang tải model
            const lower = logLine.toLowerCase();
            if (lower.includes('download') && lower.includes('model')) {
                whisperProgress[trackId].status = 'downloading';
            } else {
                whisperProgress[trackId].status = 'processing';
            }
            whisperProgress[trackId].updatedAt = Date.now();
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
            whisperProgress[trackId].updatedAt = Date.now();
            whisperProgress[trackId].doneAt = Date.now();
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

    // API: Kiểm tra môi trường Whisper/PyTorch (CUDA/GPU)
    router.get('/whisper-env', async (req, res) => {
        const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
        const pyCode = `import json\ntry:\n    import torch\n    info = {\n        'torch': getattr(torch, '__version__', None),\n        'cuda_version': getattr(getattr(torch, 'version', None), 'cuda', None),\n        'cuda_is_available': torch.cuda.is_available(),\n    }\n    if info['cuda_is_available']:\n        try:\n            info['gpu_count'] = torch.cuda.device_count()\n            info['gpu_name'] = torch.cuda.get_device_name(0)\n            info['gpu_capability'] = torch.cuda.get_device_capability(0)\n        except Exception as e:\n            info['gpu_error'] = str(e)\nexcept Exception as e:\n    info = {'error': 'torch_import_failed', 'detail': str(e)}\nprint(json.dumps(info))`;

        const child = spawn(pythonCmd, ['-c', pyCode], { windowsHide: true });
        let out = '';
        let err = '';
        child.stdout.on('data', d => out += d.toString());
        child.stderr.on('data', d => err += d.toString());
        child.on('close', (code) => {
            if (code !== 0) {
                return res.status(500).json({ error: 'python_exec_failed', detail: err.trim() || `exit ${code}` });
            }
            try {
                const info = JSON.parse(out);
                return res.json(info);
            } catch (e) {
                return res.status(500).json({ error: 'parse_failed', raw: out.trim(), detail: String(e) });
            }
        });
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
