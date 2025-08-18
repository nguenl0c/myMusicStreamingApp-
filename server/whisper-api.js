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

    // KHẮC PHỤC LỖI:
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
        const jobDir = path.join(__dirname, "server", "karaoke", jobId);
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
            message: 'Đang trích xuất lời bài hát bằng AI...',
            jobId,
            result: null
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
            '--model', 'small',
            '--formats', 'json',
        ];

        console.log(`[Job ${jobId}] Bắt đầu xử lý AI:`, args.join(' '));
        const child = spawn(pythonCmd, args, { windowsHide: true, env: { ...process.env, PYTHONIOENCODING: 'utf-8' } });

        child.stderr.on('data', (data) => {
            console.log(`[Job ${jobId}] stderr: ${data}`);
        });

        child.on('close', (code) => {
            if (code === 0) {
                console.log(`[Job ${jobId}] Xử lý AI thành công.`);
                jobs[jobId].status = 'completed';
                jobs[jobId].message = 'Hoàn tất!';
                jobs[jobId].result = {
                    sessionId: jobId,
                    instrumentalUrl: `/karaoke/${jobId}/${path.basename(instrumentalDest)}`,
                    lyricsUrl: `/karaoke/${jobId}/lyrics.json`
                };
            } else {
                console.error(`[Job ${jobId}] Xử lý AI thất bại với mã lỗi ${code}.`);
                jobs[jobId].status = 'failed';
                jobs[jobId].message = 'Trích xuất lời thất bại. Vui lòng thử lại.';
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

        res.json(job);
    });

    return router;
}
