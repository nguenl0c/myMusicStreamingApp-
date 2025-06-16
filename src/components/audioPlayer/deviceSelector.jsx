import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { getValidToken } from '../../spotify';

// Biến toàn cục để quản lý trạng thái SDK
window.spotifySDKInitialized = window.spotifySDKInitialized || false;
window.spotifyPlayerInstances = window.spotifyPlayerInstances || {};
window.webPlaybackDeviceIds = window.webPlaybackDeviceIds || {};

export default function DeviceSelector({ onDeviceActivated, token, activeDevice, playerContext = 'default' }) {
    const [devices, setDevices] = useState([]);
    const [filteredDevices, setFilteredDevices] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [localDeviceId, setLocalDeviceId] = useState(null);
    const [showDuplicates, setShowDuplicates] = useState(false);
    const [deletingDevice, setDeletingDevice] = useState(null);

    // Khởi tạo SDK - chỉ làm một lần duy nhất
    useEffect(() => {
        // Nếu SDK đã được khởi tạo, không làm lại
        if (window.spotifySDKInitialized) {
            fetchDevices();
            return;
        }

        // Khởi tạo SDK
        const script = document.createElement('script');
        script.id = 'spotify-player';
        script.src = 'https://sdk.scdn.co/spotify-player.js';
        script.async = true;

        script.onload = () => {
            console.log('Script Spotify đã được tải');
        };

        // Lưu callback gốc
        const originalCallback = window.onSpotifyWebPlaybackSDKReady;

        window.onSpotifyWebPlaybackSDKReady = () => {
            console.log('SDK đã sẵn sàng');
            window.spotifySDKInitialized = true;

            if (originalCallback) {
                originalCallback();
            }

            initializePlayer();
        };

        document.body.appendChild(script);

        return () => {
            // Không xóa script hoặc reset biến - chúng cần được dùng lại
        };
    }, []);

    // Khởi tạo Player khi SDK đã sẵn sàng
    const initializePlayer = async () => {
        try {
            // Nếu đã có instance cho context này, không tạo mới
            if (window.spotifyPlayerInstances[playerContext]) {
                console.log(`Sử dụng lại player cho context ${playerContext}`);
                setLocalDeviceId(window.webPlaybackDeviceIds[playerContext]);
                setIsLoading(false);
                return;
            }

            const validToken = await getValidToken();
            
            // Tạo tên độc nhất cho thiết bị để tránh trùng lặp và gắn context
            const deviceName = `Web Player (${document.title}) - ${playerContext} - ${Math.floor(Date.now() / 1000)}`;

            const player = new window.Spotify.Player({
                name: deviceName,
                getOAuthToken: cb => { cb(validToken); },
                volume: 0.5
            });

            // Xử lý sự kiện
            player.addListener('ready', ({ device_id }) => {
                console.log(`Player cho context ${playerContext} đã sẵn sàng với ID:`, device_id);
                setLocalDeviceId(device_id);
                
                // Lưu ID thiết bị web hiện tại vào biến toàn cục theo context
                window.webPlaybackDeviceIds[playerContext] = device_id;
                
                setIsLoading(false);
                window.spotifyPlayerInstances[playerContext] = player;

                // Cập nhật danh sách thiết bị
                fetchDevices();
            });

            player.addListener('not_ready', ({ device_id }) => {
                console.log(`Player cho context ${playerContext} không sẵn sàng:`, device_id);
            });

            // Kết nối player
            await player.connect();
        } catch (err) {
            console.error('Lỗi khởi tạo player:', err);
            setError('Không thể khởi tạo player Spotify');
            setIsLoading(false);
        }
    };

    // Lấy danh sách thiết bị
    const fetchDevices = async () => {
        try {
            setIsLoading(true);
            const validToken = await getValidToken();

            const response = await axios.get('https://api.spotify.com/v1/me/player/devices', {
                headers: { Authorization: `Bearer ${validToken}` }
            });

            if (response.data && response.data.devices) {
                setDevices(response.data.devices);
                
                // Lọc danh sách thiết bị
                filterDevices(response.data.devices);

                setError(null);
                return response.data.devices;
            }

            return [];
        } catch (err) {
            console.error('Lỗi khi lấy danh sách thiết bị:', err);
            setError('Không thể lấy danh sách thiết bị');
            return [];
        } finally {
            setIsLoading(false);
        }
    };

    // Lọc danh sách thiết bị để loại bỏ những thiết bị rác
    const filterDevices = (deviceList) => {
        // Nếu hiển thị tất cả thiết bị
        if (showDuplicates) {
            setFilteredDevices(deviceList);
            return;
        }
        
        // Phân loại thiết bị
        const webDevices = [];
        const otherDevices = [];
        
        // Thiết bị web hiện tại cho context cụ thể (nếu có)
        const currentWebDeviceId = window.webPlaybackDeviceIds[playerContext];
        const currentWebDevice = currentWebDeviceId ? 
            deviceList.find(d => d.id === currentWebDeviceId) : null;
        
        deviceList.forEach(device => {
            // Nếu là thiết bị web player
            if (device.name.includes('Web Player') || device.type.toLowerCase() === 'computer') {
                // Nếu là thiết bị hiện tại cho context này hoặc đang active, ưu tiên giữ lại
                if ((currentWebDevice && device.id === currentWebDevice.id) || 
                    device.is_active || 
                    device.id === localDeviceId) {
                    webDevices.unshift(device); // Đưa lên đầu danh sách
                } else if (!showDuplicates) {
                    // Bỏ qua các thiết bị web khác nếu không hiển thị trùng lặp
                } else {
                    webDevices.push(device);
                }
            } else {
                // Các thiết bị khác (mobile, tablet, desktop app)
                otherDevices.push(device);
            }
        });
        
        // Kết hợp lại, ưu tiên thiết bị không phải web đầu tiên
        setFilteredDevices([...otherDevices, ...webDevices]);
    };

    // Kích hoạt thiết bị
    const activateDevice = async (deviceId) => {
        try {
            const validToken = await getValidToken();

            await axios.put('https://api.spotify.com/v1/me/player', {
                device_ids: [deviceId],
                play: false
            }, {
                headers: { Authorization: `Bearer ${validToken}` }
            });

            console.log(`Đã kích hoạt thiết bị ${deviceId} cho context ${playerContext}`);

            // Callback về component cha
            if (onDeviceActivated) {
                onDeviceActivated(deviceId);
            }

            // Refresh danh sách thiết bị
            fetchDevices();
        } catch (err) {
            console.error('Lỗi khi kích hoạt thiết bị:', err);
            setError('Không thể kích hoạt thiết bị');
        }
    };
    
    // Xóa thiết bị rác (Spotify không có API chính thức để xóa thiết bị,
    // cách này chỉ để "ẩn" thiết bị khỏi giao diện)
    const removeDevice = (deviceId) => {
        setDeletingDevice(deviceId);
        
        // Loại bỏ thiết bị khỏi danh sách hiển thị
        const updatedDevices = filteredDevices.filter(d => d.id !== deviceId);
        setFilteredDevices(updatedDevices);
        
        setTimeout(() => {
            setDeletingDevice(null);
        }, 2000);
    };

    // Xác định xem thiết bị có phải là thiết bị rác không
    const isDuplicateWebDevice = (device) => {
        // Kiểm tra xem thiết bị có phải là thiết bị hiện tại cho bất kỳ context nào không
        for (const contextId in window.webPlaybackDeviceIds) {
            if (window.webPlaybackDeviceIds[contextId] === device.id) return false;
        }
        
        // Nếu đang active, không phải rác
        if (device.is_active) return false;
        
        // Nếu có "Web Player" trong tên và không phải thiết bị hiện tại
        return device.name.includes('Web Player') || 
            (device.type.toLowerCase() === 'computer' && !device.is_active);
    };

    // Kiểm tra xem thiết bị có liên quan đến context hiện tại không
    const isCurrentContextDevice = (device) => {
        const currentDeviceId = window.webPlaybackDeviceIds[playerContext];
        return device.id === currentDeviceId || device.id === localDeviceId;
    };

    return (
        <div className="w-full p-4 rounded-lg">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-white text-lg font-bold">Thiết bị Spotify</h3>
                <div className="flex gap-2">
                    <button
                        onClick={() => {
                            setShowDuplicates(!showDuplicates);
                            filterDevices(devices);
                        }}
                        className="px-3 py-1 bg-gray-700 text-white rounded-full text-sm"
                    >
                        {showDuplicates ? "Ẩn thiết bị trùng" : "Hiện tất cả"}
                    </button>
                    <button
                        onClick={fetchDevices}
                        disabled={isLoading}
                        className="px-3 py-1 bg-[#1DB954] text-white rounded-full disabled:opacity-50 text-sm"
                    >
                        {isLoading ? 'Đang tải...' : 'Làm mới'}
                    </button>
                </div>
            </div>

            {error && (
                <div className="bg-red-900 text-white p-2 rounded-md mb-4 text-sm">
                    {error}
                </div>
            )}

            {isLoading ? (
                <div className="text-center py-4 text-gray-400">Đang tải thiết bị...</div>
            ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                    {filteredDevices.length === 0 ? (
                        <div className="text-center py-4 text-gray-400">
                            Không tìm thấy thiết bị
                        </div>
                    ) : (
                        filteredDevices.map(device => (
                            <div
                                key={device.id}
                                className={`p-3 rounded-md cursor-pointer relative ${
                                    device.is_active
                                        ? 'bg-[#1DB954] bg-opacity-30 border border-[#1DB954]'
                                        : isCurrentContextDevice(device)
                                            ? 'bg-[#1a3c28] hover:bg-[#2a4c38]'
                                            : isDuplicateWebDevice(device)
                                                ? 'bg-[#3a3a3a] hover:bg-[#444444]'
                                                : 'bg-[#282828] hover:bg-[#333333]'
                                }`}
                            >
                                <div className="flex justify-between items-center">
                                    <div 
                                        className="flex-1"
                                        onClick={() => !device.is_active && activateDevice(device.id)}
                                    >
                                        <p className="text-white font-medium">
                                            {device.name}
                                            {device.id === window.webPlaybackDeviceIds[playerContext] && " (Cho player này)"}
                                        </p>
                                        <p className="text-gray-400 text-sm">{device.type}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {device.is_active && (
                                            <span className="bg-[#1DB954] text-xs text-white px-2 py-1 rounded-full">
                                                Đang hoạt động
                                            </span>
                                        )}
                                        
                                        {isDuplicateWebDevice(device) && (
                                            <button
                                                className="text-xs bg-red-700 hover:bg-red-600 text-white px-2 py-1 rounded-full"
                                                onClick={() => removeDevice(device.id)}
                                                disabled={deletingDevice === device.id}
                                            >
                                                {deletingDevice === device.id ? "Đã ẩn" : "Ẩn"}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}

            <div className="mt-4 text-xs text-gray-500">
                <p>* Thiết bị web mới sẽ được tạo mỗi khi làm mới trang</p>
                <p>* Các thiết bị rác sẽ tự động bị ẩn để tránh gây nhầm lẫn</p>
                <p>* Mỗi player có thể dùng thiết bị riêng, tránh xung đột</p>
            </div>
        </div>
    );
}
