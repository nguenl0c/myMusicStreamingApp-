-- Database schema for file management
-- This replaces direct file system storage with database references

CREATE TABLE music_files (
    id VARCHAR(36) PRIMARY KEY,
    original_name VARCHAR(255) NOT NULL,
    filename VARCHAR(255) NOT NULL,
    file_type ENUM('upload', 'stem', 'mixed') NOT NULL,
    storage_path VARCHAR(500) NOT NULL,
    file_size BIGINT NOT NULL,
    mime_type VARCHAR(100),
    uploaded_by VARCHAR(100),
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    metadata JSON,
    status ENUM('uploading', 'processing', 'ready', 'error') DEFAULT 'ready',
    INDEX idx_type (file_type),
    INDEX idx_uploaded_by (uploaded_by),
    INDEX idx_status (status)
);

CREATE TABLE track_stems (
    id INT AUTO_INCREMENT PRIMARY KEY,
    track_id VARCHAR(36) NOT NULL,
    original_file_id VARCHAR(36) NOT NULL,
    vocals_file_id VARCHAR(36),
    drums_file_id VARCHAR(36),
    bass_file_id VARCHAR(36),
    other_file_id VARCHAR(36),
    processing_status ENUM('pending', 'processing', 'completed', 'failed') DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP NULL,
    FOREIGN KEY (original_file_id) REFERENCES music_files(id) ON DELETE CASCADE,
    FOREIGN KEY (vocals_file_id) REFERENCES music_files(id) ON DELETE SET NULL,
    FOREIGN KEY (drums_file_id) REFERENCES music_files(id) ON DELETE SET NULL,
    FOREIGN KEY (bass_file_id) REFERENCES music_files(id) ON DELETE SET NULL,
    FOREIGN KEY (other_file_id) REFERENCES music_files(id) ON DELETE SET NULL,
    INDEX idx_track_id (track_id),
    INDEX idx_status (processing_status)
);

CREATE TABLE mixed_tracks (
    id INT AUTO_INCREMENT PRIMARY KEY,
    mix_id VARCHAR(36) NOT NULL,
    output_file_id VARCHAR(36) NOT NULL,
    source_stems JSON NOT NULL, -- Array of stem file IDs used
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (output_file_id) REFERENCES music_files(id) ON DELETE CASCADE,
    INDEX idx_mix_id (mix_id)
);
