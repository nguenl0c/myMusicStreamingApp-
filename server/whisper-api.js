import express from "express";
import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import process from "process";
import multer from "multer";
import { randomUUID } from "crypto";

// Cấu trúc để lưu trạng thái các công việc (jobs) đang xử lý.
const jobs = {};

/**
 * Tạo một router Express chuyên dụng cho luồng Karaoke độc lập.
 * @returns {express.Router}
 */
export default function createKaraokeRouter() {
    const router = express.Router();
    const __dirname = path.resolve();
    const karaokeBaseDir = path.join(__dirname, "server", "karaoke");

    // 1. Cấu hình Multer để lưu file vào một thư mục tạm chung.
    const tempUploadDir = path.join(__dirname, "server", "uploads");
    if (!fs.existsSync(tempUploadDir)) {
        fs.mkdirSync(tempUploadDir, { recursive: true });
    }
    const upload = multer({ dest: tempUploadDir });


    /**
     * API: Bắt đầu một phiên tạo Karaoke mới.
     * Chức năng: Nhận file, tạo job, trả về jobId ngay lập tức và bắt đầu xử lý AI trong nền.
     */
    router.post('/create', upload.fields([
        { name: 'vocalTrack', maxCount: 1 },
        { name: 'instrumentalTrack', maxCount: 1 }
    ]), (req, res) => {

        const vocalFile = req.files?.vocalTrack?.[0];
        const instrumentalFile = req.files?.instrumentalTrack?.[0];

        if (!vocalFile || !instrumentalFile) {
            return res.status(400).json({ error: "Vui lòng cung cấp đủ cả 2 file nhạc." });
        }

        // KHẮC PHỤC LỖI:
        // 2. Tạo jobId và thư mục session SAU KHI multer đã upload file thành công.
        const jobId = `job_${randomUUID()}`;
    const jobDir = path.join(karaokeBaseDir, jobId);
        fs.mkdirSync(jobDir, { recursive: true });

        // 3. Di chuyển file từ thư mục tạm vào thư mục session với tên chuẩn.
        const vocalExt = path.extname(vocalFile.originalname) || '.mp3';
        const instrumentalExt = path.extname(instrumentalFile.originalname) || '.mp3';
        const vocalDest = path.join(jobDir, `vocals${vocalExt}`);
        const instrumentalDest = path.join(jobDir, `instrumental${instrumentalExt}`);

        try {
            fs.renameSync(vocalFile.path, vocalDest);
            fs.renameSync(instrumentalFile.path, instrumentalDest);
        } catch (renameErr) {
            console.error(`[Job ${jobId}] Lỗi khi di chuyển file:`, renameErr);
            return res.status(500).json({ error: "Lỗi hệ thống file trên server." });
        }

        // Tạo job và lưu trạng thái ban đầu.
        jobs[jobId] = {
            status: 'processing',
            message: 'Đang chuẩn bị xử lý...',
            jobId,
            result: null,
            progress: 5,
            _tick: null,
        };

        // Trả về jobId cho client ngay lập tức.
        res.status(202).json({ jobId });

        // --- Bắt đầu xử lý AI trong nền (logic không đổi) ---
        const pythonCmd = process.platform === "win32" ? "python" : "python3";
        const scriptPath = path.join(__dirname, 'server', 'python', 'karaoke.py');
        const args = [
            scriptPath,
            '--input', vocalDest, // Sử dụng đường dẫn file mới
            '--output_dir', jobDir,
            '--model', 'large-v3-turbo',
            '--formats', 'json',
        ];

        console.log(`[Job ${jobId}] Bắt đầu xử lý AI:`, args.join(' '));
        const child = spawn(pythonCmd, args, { windowsHide: true, env: { ...process.env, PYTHONIOENCODING: 'utf-8' } });

        // Cập nhật tiến trình theo thời gian (ước lượng) cho đến 95%
        try {
            if (!jobs[jobId]._tick) {
                jobs[jobId]._tick = setInterval(() => {
                    const job = jobs[jobId];
                    if (!job || job.status !== 'processing') return;
                    const next = Math.min(95, (job.progress || 0) + 1);
                    job.progress = next;
                }, 1000);
            }
        } catch (e) {
            console.warn(`[Job ${jobId}] Không thể khởi tạo tick tiến trình:`, e);
        }

        const markPhase = (text) => {
            const job = jobs[jobId];
            if (!job) return;
            if (text.includes('Đang tải mô hình')) {
                job.message = 'Đang tải mô hình...';
                job.progress = Math.max(job.progress || 0, 10);
            } else if (text.includes('Đang phiên âm')) {
                job.message = 'Đang phiên âm...';
                job.progress = Math.max(job.progress || 0, 50);
            }
        };

        child.stdout?.setEncoding('utf8');
        child.stdout?.on('data', (data) => {
            const s = data.toString();
            markPhase(s);
        });

        child.stderr.on('data', (data) => {
            const s = data.toString();
            console.log(`[Job ${jobId}] stderr: ${s}`);
            markPhase(s);
        });

        child.on('close', (code) => {
            // Dừng tick nếu còn
            try {
                if (jobs[jobId]?._tick) {
                    clearInterval(jobs[jobId]._tick);
                    jobs[jobId]._tick = null;
                }
            } catch {
                // ignore cleanup errors
            }
            if (code === 0) {
                console.log(`[Job ${jobId}] Xử lý AI thành công.`);
                jobs[jobId].status = 'completed';
                jobs[jobId].message = 'Hoàn tất!';
                jobs[jobId].progress = 100;
                // Ghi file info.json để lưu meta (ví dụ tên bài hát)
                try {
                    const infoPath = path.join(jobDir, 'info.json');
                    const inferredSongName = path.basename(vocalDest, path.extname(vocalDest));
                    fs.writeFileSync(infoPath, JSON.stringify({ songName: inferredSongName }, null, 2), 'utf-8');
                } catch (werr) {
                    console.warn(`[Job ${jobId}] Không thể ghi info.json:`, werr);
                }
                jobs[jobId].result = {
                    sessionId: jobId,
                    instrumentalUrl: `/karaoke/${jobId}/${path.basename(instrumentalDest)}`,
                    lyricsUrl: `/karaoke/${jobId}/lyrics.json`
                };
            } else {
                console.error(`[Job ${jobId}] Xử lý AI thất bại với mã lỗi ${code}.`);
                jobs[jobId].status = 'failed';
                jobs[jobId].message = 'Trích xuất lời thất bại. Vui lòng thử lại.';
                jobs[jobId].progress = jobs[jobId].progress || 0;
            }
        });
    });

    /**
     * API: Kiểm tra trạng thái của một công việc (job).
     */
    router.get('/status/:jobId', (req, res) => {
        const { jobId } = req.params;
        const job = jobs[jobId];

        if (!job) {
            return res.status(404).json({ error: "Không tìm thấy công việc." });
        }

    // Loại bỏ thuộc tính vòng tham chiếu (_tick) trước khi trả JSON
    const { _tick, ...safeJob } = job;
    return res.json(safeJob);
    });

    // THÊM MỚI: API để lấy danh sách các phiên karaoke đã xử lý
    router.get('/sessions', (req, res) => {
    const karaokeDir = karaokeBaseDir;
    if (!fs.existsSync(karaokeDir)) {
            return res.json([]);
        }

        try {
            const sessionIds = fs.readdirSync(karaokeDir, { withFileTypes: true })
                .filter(dirent => dirent.isDirectory())
                .map(dirent => dirent.name);

            const sessions = sessionIds.map(sessionId => {
                const sessionDir = path.join(karaokeDir, sessionId);
                const files = fs.readdirSync(sessionDir);

                const infoFile = files.find(f => f === 'info.json');
                const lyricsFile = files.find(f => f === 'lyrics.json');
                const instrumentalFile = files.find(f => f.startsWith('instrumental.'));

                // Cần tối thiểu lyrics và instrumental để phát
                if (!lyricsFile || !instrumentalFile) {
                    return null; // Session chưa hoàn chỉnh, bỏ qua
                }

                let songName = sessionId;
                if (infoFile) {
                    try {
                        const info = JSON.parse(fs.readFileSync(path.join(sessionDir, infoFile), 'utf-8'));
                        if (info.songName) songName = info.songName;
                    } catch (perr) {
                        console.warn(`Không đọc được info.json cho session ${sessionId}:`, perr);
                    }
                } else {
                    // Suy luận từ tên file vocal/instrumental nếu có
                    const vocalName = files.find(f => f.startsWith('vocals.')) || files.find(f => f.startsWith('vocal.'));
                    if (vocalName) {
                        songName = path.basename(vocalName, path.extname(vocalName));
                    } else {
                        songName = path.basename(instrumentalFile, path.extname(instrumentalFile));
                    }
                }

                return {
                    sessionId,
                    songName,
                    instrumentalUrl: `/karaoke/${sessionId}/${instrumentalFile}`,
                };
            }).filter(Boolean); // Lọc bỏ các session null (chưa hoàn chỉnh)

            res.json(sessions);
        } catch (error) {
            console.error("Lỗi khi đọc danh sách session:", error);
            res.status(500).json({ error: "Không thể lấy danh sách lịch sử." });
        }
    });

    // XÓA một session: xóa cả thư mục sessionId
    router.delete('/sessions/:sessionId', (req, res) => {
        const { sessionId } = req.params;
        if (!sessionId || sessionId.includes('..') || path.isAbsolute(sessionId)) {
            return res.status(400).json({ error: 'sessionId không hợp lệ' });
        }
        try {
            const dir = path.join(karaokeBaseDir, sessionId);
            if (!fs.existsSync(dir)) {
                return res.status(404).json({ error: 'Không tìm thấy session' });
            }
            fs.rmSync(dir, { recursive: true, force: true });
            delete jobs[sessionId];
            return res.json({ ok: true });
        } catch (err) {
            console.error('Lỗi xóa session:', err);
            return res.status(500).json({ error: 'Xóa thất bại' });
        }
    });

    // ĐỔI TÊN hiển thị (không đổi thư mục/id)
    router.patch('/sessions/:sessionId/rename', (req, res) => {
        const { sessionId } = req.params;
        let { newName } = req.body || {};
        if (!sessionId || sessionId.includes('..') || path.isAbsolute(sessionId)) {
            return res.status(400).json({ error: 'sessionId không hợp lệ' });
        }
        if (!newName || typeof newName !== 'string' || !newName.trim()) {
            return res.status(400).json({ error: 'newName là bắt buộc' });
        }
        const displayName = newName.trim();

        try {
            const dir = path.join(karaokeBaseDir, sessionId);
            if (!fs.existsSync(dir)) {
                return res.status(404).json({ error: 'Không tìm thấy session' });
            }
            const infoPath = path.join(dir, 'info.json');
            let info = {};
            if (fs.existsSync(infoPath)) {
                try { info = JSON.parse(fs.readFileSync(infoPath, 'utf-8')); }
                catch (perr) { console.warn('[Rename] Không parse được info.json cũ:', perr); }
            }
            info.songName = displayName;
            fs.writeFileSync(infoPath, JSON.stringify(info, null, 2), 'utf-8');

            return res.json({ ok: true, sessionId, songName: displayName });
        } catch (err) {
            console.error('Lỗi đổi tên session:', err);
            return res.status(500).json({ error: 'Đổi tên thất bại' });
        }
    });

    // CẬP NHẬT LỜI: ghi đè file lyrics.json của một session
    router.patch('/sessions/:sessionId/lyrics', (req, res) => {
        const { sessionId } = req.params;
        if (!sessionId || sessionId.includes('..') || path.isAbsolute(sessionId)) {
            return res.status(400).json({ error: 'sessionId không hợp lệ' });
        }

        const dir = path.join(karaokeBaseDir, sessionId);
        if (!fs.existsSync(dir)) {
            return res.status(404).json({ error: 'Không tìm thấy session' });
        }

        // Cho phép body là mảng (lyrics) hoặc { lyrics: [...] }
        const body = req.body;
        const lyrics = Array.isArray(body) ? body : body?.lyrics;
        if (!Array.isArray(lyrics)) {
            return res.status(400).json({ error: 'Dữ liệu lyrics không hợp lệ, cần là một mảng.' });
        }

        // Kiểm tra cơ bản cấu trúc
        const isValid = lyrics.every(line =>
            line && typeof line.start === 'number' && typeof line.end === 'number' && Array.isArray(line.words) &&
            line.words.every(w => w && typeof w.word === 'string' && typeof w.start === 'number' && typeof w.end === 'number')
        );
        if (!isValid) {
            return res.status(400).json({ error: 'Cấu trúc lyrics không đúng định dạng.' });
        }

        try {
            const lyricsPath = path.join(dir, 'lyrics.json');
            // Tạo bản sao lưu trước khi ghi đè
            if (fs.existsSync(lyricsPath)) {
                const ts = new Date().toISOString().replace(/[:.]/g, '-');
                const backupPath = path.join(dir, `lyrics.backup-${ts}.json`);
                fs.copyFileSync(lyricsPath, backupPath);
            }

            fs.writeFileSync(lyricsPath, JSON.stringify(lyrics, null, 2), 'utf-8');
            return res.json({ ok: true });
        } catch (err) {
            console.error('Lỗi ghi lyrics:', err);
            return res.status(500).json({ error: 'Không thể lưu lyrics' });
        }
    });


    return router;
}