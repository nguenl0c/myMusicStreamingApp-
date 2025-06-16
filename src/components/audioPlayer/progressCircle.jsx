// progressCircle.jsx
import React from 'react';

const ProgressCircle = ({ progress, size = 240, trackWidth = 4, trackColor = "rgba(255,255,255,0.3)", indicatorWidth = 4, indicatorColor = "#1DB954", children }) => {
  const center = size / 2;
  const radius = center - (trackWidth > indicatorWidth ? trackWidth : indicatorWidth);
  const circumference = 2 * Math.PI * radius;
  const progressOffset = circumference - (progress * circumference);

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg
        className="absolute top-0 left-0"
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
      >
        {/* Đường tròn nền */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="transparent"
          stroke={trackColor}
          strokeWidth={trackWidth}
        />
        
        {/* Chỉ báo tiến trình */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="transparent"
          stroke={indicatorColor}
          strokeWidth={indicatorWidth}
          strokeDasharray={circumference}
          strokeDashoffset={progressOffset}
          strokeLinecap="round"
          transform={`rotate(-90 ${center} ${center})`}
        />
      </svg>
      
      {/* Nội dung - Hình ảnh Album */}
      <div className="absolute inset-0 flex items-center justify-center">
        {children}
      </div>
    </div>
  );
};

export default ProgressCircle;
