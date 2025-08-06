// services/fileStorageService.js
import fs from 'fs';
import path from 'path';
import process from 'process';
import { v4 as uuidv4 } from 'uuid';

class FileStorageService {
  constructor() {
    // Separate storage directories outside project
    this.uploadDir = process.env.UPLOAD_DIR || 'D:/MusicStreamingData/uploads';
    this.outputDir = process.env.OUTPUT_DIR || 'D:/MusicStreamingData/outputs';
    this.mixedDir = process.env.MIXED_DIR || 'D:/MusicStreamingData/mixed';
    
    // Ensure directories exist
    this.ensureDirectoriesExist();
  }

  ensureDirectoriesExist() {
    [this.uploadDir, this.outputDir, this.mixedDir].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  // Save uploaded file
  async saveUploadedFile(buffer, originalName, userId) {
    const fileId = uuidv4();
    const extension = path.extname(originalName);
    const filename = `${fileId}${extension}`;
    const filepath = path.join(this.uploadDir, filename);
    
    await fs.promises.writeFile(filepath, buffer);
    
    // Return file metadata for database storage
    return {
      fileId,
      originalName,
      filename,
      filepath,
      size: buffer.length,
      uploadedBy: userId,
      uploadedAt: new Date(),
      type: 'upload'
    };
  }

  // Save processed stems
  async saveStemFiles(trackId, stemsData) {
    const outputPath = path.join(this.outputDir, trackId);
    if (!fs.existsSync(outputPath)) {
      fs.mkdirSync(outputPath, { recursive: true });
    }

    const stemFiles = {};
    for (const [stemType, buffer] of Object.entries(stemsData)) {
      const filename = `${stemType}.mp3`;
      const filepath = path.join(outputPath, filename);
      await fs.promises.writeFile(filepath, buffer);
      
      stemFiles[stemType] = {
        filename,
        filepath,
        size: buffer.length,
        url: `/api/stream/stem/${trackId}/${stemType}`
      };
    }

    return stemFiles;
  }

  // Get file stream for API serving
  getFileStream(fileId, type = 'upload') {
    let filepath;
    switch (type) {
      case 'upload':
        filepath = path.join(this.uploadDir, fileId);
        break;
      case 'stem':
        filepath = path.join(this.outputDir, fileId);
        break;
      case 'mixed':
        filepath = path.join(this.mixedDir, fileId);
        break;
      default:
        throw new Error('Invalid file type');
    }

    if (!fs.existsSync(filepath)) {
      throw new Error('File not found');
    }

    return fs.createReadStream(filepath);
  }

  // Delete files
  async deleteTrackFiles(trackId) {
    const uploadFile = path.join(this.uploadDir, `${trackId}.mp3`);
    const outputDir = path.join(this.outputDir, trackId);
    
    // Delete uploaded file
    if (fs.existsSync(uploadFile)) {
      await fs.promises.unlink(uploadFile);
    }

    // Delete stems directory
    if (fs.existsSync(outputDir)) {
      await fs.promises.rm(outputDir, { recursive: true });
    }
  }
}

export default new FileStorageService();
