import React, { useState, useEffect, useRef } from 'react';
import { createKaraokeSession, getKaraokeJobStatus } from '../services/karaokeApi';
import KaraokePlayer from '../components/karaoke/KaraokePlayer';

export default function KaraokeCreator() {
  const [vocalFile, setVocalFile] = useState(null);
  const [instrumentalFile, setInstrumentalFile] = useState(null);
  const [jobId, setJobId] = useState(null);
  const [jobStatus, setJobStatus] = useState({ status: 'idle', message: '' });
  const [karaokeData, setKaraokeData] = useState(null); // { sessionId, instrumentalUrl }
  const [error, setError] = useState('');

  const pollInterval = useRef(null);

  // Effect để polling trạng thái job
  useEffect(() => {
    if (jobId && (jobStatus.status === 'processing' || jobStatus.status === 'pending')) {
      pollInterval.current = setInterval(async () => {
        try {
          const status = await getKaraokeJobStatus(jobId);
          setJobStatus(status);
          if (status.status === 'completed') {
            setKaraokeData(status.result);
            clearInterval(pollInterval.current);
          } else if (status.status === 'failed') {
            setError(status.message);
            clearInterval(pollInterval.current);
          }
        } catch (err) {
          setError('Không thể lấy trạng thái xử lý.');
          clearInterval(pollInterval.current);
        }
      }, 3000); // Hỏi thăm mỗi 3 giây
    }
    return () => {
      if (pollInterval.current) clearInterval(pollInterval.current);
    };
  }, [jobId, jobStatus.status]);


  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!vocalFile || !instrumentalFile) {
      setError('Vui lòng chọn đủ cả 2 file.');
      return;
    }
    setError('');
    setJobStatus({ status: 'pending', message: 'Đang tải file lên server...' });
    try {
      const newJobId = await createKaraokeSession(vocalFile, instrumentalFile);
      setJobId(newJobId);
    } catch (err) {
      setError('Tải file thất bại. Vui lòng thử lại.');
      setJobStatus({ status: 'idle', message: '' });
    }
  };

  const handleReset = () => {
    setVocalFile(null);
    setInstrumentalFile(null);
    setJobId(null);
    setJobStatus({ status: 'idle', message: '' });
    setKaraokeData(null);
    setError('');
  }

  // Nếu đã có dữ liệu karaoke, hiển thị trình phát
  if (karaokeData) {
    return <KaraokePlayer data={karaokeData} onBack={handleReset} />;
  }

  // Giao diện upload và hiển thị tiến trình
  return (
    <div className="p-6 text-white screen-container mx-auto">
      <h1 className="text-3xl font-bold mb-4">Tạo Karaoke</h1>
      <p className="text-gray-400 mb-6">Tải lên bài hát gốc và nhạc nền để hệ thống tự động tạo lời và đồng bộ.</p>

      <form onSubmit={handleSubmit} className="bg-white/5 rounded-xl p-6 space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">1. Bài hát gốc (có lời)</label>
          <input type="file" accept="audio/*" onChange={e => setVocalFile(e.target.files[0])} className="file-input file-input-bordered w-full" />
          {vocalFile && <p className="text-xs text-gray-400 mt-1">Đã chọn: {vocalFile.name}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">2. Nhạc nền (không lời)</label>
          <input type="file" accept="audio/*" onChange={e => setInstrumentalFile(e.target.files[0])} className="file-input file-input-bordered w-full" />
          {instrumentalFile && <p className="text-xs text-gray-400 mt-1">Đã chọn: {instrumentalFile.name}</p>}
        </div>

        <button type="submit" className="btn btn-primary w-full" disabled={jobStatus.status === 'pending' || jobStatus.status === 'processing'}>
          {jobStatus.status === 'pending' || jobStatus.status === 'processing' ? 'Đang xử lý...' : 'Tạo Karaoke'}
        </button>
      </form>

      {(jobStatus.status === 'pending' || jobStatus.status === 'processing') && (
        <div className="mt-6 text-center">
          <p className="text-lg">{jobStatus.message}</p>
          <p className="text-sm text-gray-400">(Việc này có thể mất vài phút, vui lòng không rời khỏi trang)</p>
          <progress className="progress progress-primary w-full mt-2"></progress>
        </div>
      )}

      {error && <p className="mt-4 text-red-400 text-center">{error}</p>}
    </div>
  );
}
