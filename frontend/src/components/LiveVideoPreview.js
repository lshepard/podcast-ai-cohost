import React, { useRef, useEffect } from 'react';

const LiveVideoPreview = ({ isActive }) => {
  const videoRef = useRef(null);

  useEffect(() => {
    let stream;
    if (isActive) {
      navigator.mediaDevices.getUserMedia({ video: true, audio: false })
        .then(s => {
          stream = s;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
        });
    }
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [isActive]);

  if (!isActive) return null;

  return (
    <video
      ref={videoRef}
      autoPlay
      muted
      playsInline
      style={{ width: '100%', maxHeight: 360, background: '#000', borderRadius: 4 }}
    />
  );
};

export default LiveVideoPreview; 