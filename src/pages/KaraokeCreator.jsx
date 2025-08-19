import React, { useState, useEffect, useRef } from 'react';
import { createKaraokeSession, getKaraokeJobStatus, getKaraokeSessions, deleteKaraokeSession, renameKaraokeSession } from '../services/karaokeApi';
import KaraokePlayer from '../components/karaoke/KaraokePlayer';
import { FaHistory } from 'react-icons/fa';

export default function KaraokeCreator() {
  const [vocalFile, setVocalFile] = useState(null);
  const [instrumentalFile, setInstrumentalFile] = useState(null);
  const [jobId, setJobId] = useState(null);
  const [jobStatus, setJobStatus] = useState({ status: 'idle', message: '' });
  const [karaokeData, setKaraokeData] = useState(null); // { sessionId, instrumentalUrl }
  const [error, setError] = useState('');

  const [sessions, setSessions] = useState([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(true);

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
        } catch (e) {
          console.error('Không thể lấy trạng thái xử lý:', e);
          setError('Không thể lấy trạng thái xử lý.');
          clearInterval(pollInterval.current);
        }
      }, 3000); // Hỏi thăm mỗi 3 giây
    }
    return () => {
      if (pollInterval.current) clearInterval(pollInterval.current);
    };
  }, [jobId, jobStatus.status]);

  useEffect(() => {
    const loadSessions = async () => {
      try {
        setIsLoadingSessions(true);
        const sessionList = await getKaraokeSessions();
        setSessions(sessionList);
      } catch (err) {
        console.error("Không thể tải lịch sử karaoke:", err);
        // Không hiển thị lỗi này cho người dùng, chỉ log ra console
      } finally {
        setIsLoadingSessions(false);
      }
    };
    loadSessions();
  }, []);

  const refreshSessions = async () => {
    try {
      setIsLoadingSessions(true);
      const sessionList = await getKaraokeSessions();
      setSessions(sessionList);
    } finally {
      setIsLoadingSessions(false);
    }
  };

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
    } catch (e) {
      console.error('Tải file thất bại:', e);
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

  const handleSessionSelect = (session) => {
    setKaraokeData({
      sessionId: session.sessionId,
      instrumentalUrl: session.instrumentalUrl,
      songName: session.songName // Truyền cả tên bài hát
    });
  };

  const handleDeleteSession = async (e, sessionId) => {
    e.stopPropagation();
    if (!confirm('Xóa phiên karaoke này? Hành động không thể hoàn tác.')) return;
    try {
      await deleteKaraokeSession(sessionId);
      await refreshSessions();
    } catch (err) {
      console.error('Xóa session thất bại:', err);
      alert('Xóa thất bại');
    }
  };

  const handleRenameSession = async (e, sessionId, prevName) => {
    e.stopPropagation();
    const newName = prompt('Nhập tên mới cho phiên karaoke:', prevName || sessionId);
    if (!newName || newName === prevName || newName === sessionId) return;
    try {
      await renameKaraokeSession(sessionId, newName);
      await refreshSessions();
    } catch (err) {
      console.error('Đổi tên thất bại:', err);
      alert('Đổi tên thất bại');
    }
  };

  // Nếu đã có dữ liệu karaoke, hiển thị trình phát
  if (karaokeData) {
    return <KaraokePlayer data={karaokeData} onBack={handleReset} />;
  }

  // Giao diện upload và hiển thị tiến trình
  return (
    <div className="p-6 text-white screen-container mx-auto">
      <div className="grid md:grid-cols-2 gap-8">
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
        <div className="bg-white/5 rounded-xl p-6">
          <h2 className="text-2xl font-bold mb-4 flex items-center gap-2"><FaHistory /> Lịch sử</h2>
          {isLoadingSessions ? (
            <p>Đang tải lịch sử...</p>
          ) : sessions.length > 0 ? (
            <ul className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
              {sessions.map(session => (
                <li key={session.sessionId}
                  onClick={() => handleSessionSelect(session)}
                  className="group cursor-pointer p-4 bg-white/5 rounded-lg hover:bg-white/10 transition-colors duration-200">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold truncate" title={session.songName}>{session.songName}</p>
                      <p className="text-xs text-gray-400">{session.sessionId}</p>
                    </div>
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button className="btn btn-xs" onClick={(e) => handleRenameSession(e, session.sessionId, session.songName)}>Đổi tên</button>
                      <button className="btn btn-xs btn-error" onClick={(e) => handleDeleteSession(e, session.sessionId)}>Xóa</button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-400">Chưa có bài hát nào được xử lý.</p>
          )}
        </div>
      </div>
    </div>
  );
}
