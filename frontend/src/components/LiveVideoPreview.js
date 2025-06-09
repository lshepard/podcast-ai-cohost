import React, { useRef, useEffect } from 'react';

const LiveVideoPreview = ({ isActive, stream }) => {
  const videoRef = useRef(null);

  useEffect(() => {
    let localStream;
    if (isActive) {
      if (stream) {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } else {
        navigator.mediaDevices.getUserMedia({ video: true, audio: false })
          .then(s => {
            localStream = s;
            if (videoRef.current) {
              videoRef.current.srcObject = localStream;
            }
          });
      }
    }
    return () => {
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [isActive, stream]);

  if (!isActive) return null;

  return (
    <video
      ref={videoRef}
      autoPlay
      muted
      playsInline
      style={{ width: '100%', maxHeight: 360, background: '#000', borderRadius: 4, transform: 'scaleX(-1)' }}
    />
  );
};

export default LiveVideoPreview; 