import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  IconButton,
  Typography,
} from '@mui/material';
import VideocamIcon from '@mui/icons-material/Videocam';
import StopIcon from '@mui/icons-material/Stop';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import useVideoRecorder from '../hooks/useVideoRecorder';
import VideoPlayer from './VideoPlayer';
import LiveVideoPreview from './LiveVideoPreview';

const VideoRecorder = ({ onVideoRecorded, onVideoUploaded, episodeId, segmentId }) => {
  const [mediaStream, setMediaStream] = useState(null);
  const [isStreamReady, setIsStreamReady] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [localVideoUrl, setLocalVideoUrl] = useState(null);
  const [cameras, setCameras] = useState([]); // List of video input devices
  const [selectedCameraId, setSelectedCameraId] = useState(''); // Selected camera deviceId
  const fileInputRef = useRef(null);

  // Enumerate cameras on mount
  useEffect(() => {
    const getCameras = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoInputs = devices.filter(device => device.kind === 'videoinput');
        setCameras(videoInputs);
        // Try to restore from localStorage
        const savedCameraId = localStorage.getItem('selectedCameraId');
        if (savedCameraId && videoInputs.some(cam => cam.deviceId === savedCameraId)) {
          setSelectedCameraId(savedCameraId);
        } else if (videoInputs.length > 0 && !selectedCameraId) {
          setSelectedCameraId(videoInputs[0].deviceId);
        }
      } catch (err) {
        setCameras([]);
      }
    };
    getCameras();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Save camera selection to localStorage when changed
  useEffect(() => {
    if (selectedCameraId) {
      localStorage.setItem('selectedCameraId', selectedCameraId);
    }
  }, [selectedCameraId]);

  // Create the stream for preview and recording, update when selectedCameraId changes
  useEffect(() => {
    let isMounted = true;
    if (selectedCameraId) {
      navigator.mediaDevices.getUserMedia({ video: { deviceId: { exact: selectedCameraId } }, audio: true })
        .then(stream => {
          if (isMounted) {
            setMediaStream(stream);
            setIsStreamReady(true);
          }
        })
        .catch(() => setIsStreamReady(false));
    } else if (!mediaStream) {
      navigator.mediaDevices.getUserMedia({ video: true, audio: true })
        .then(stream => {
          if (isMounted) {
            setMediaStream(stream);
            setIsStreamReady(true);
          }
        })
        .catch(() => setIsStreamReady(false));
    } else {
      setIsStreamReady(true);
    }
    return () => {
      isMounted = false;
      if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCameraId]); // re-run when selectedCameraId changes

  // Pass the stream to the recorder hook
  const { isRecording, videoBlob, error, startRecording, stopRecording, setVideoBlob } = useVideoRecorder(mediaStream);

  // When recording is completed and blob is available
  React.useEffect(() => {
    if (videoBlob) {
      const url = URL.createObjectURL(videoBlob);
      setLocalVideoUrl(url);
      // Cleanup when component unmounts
      return () => {
        URL.revokeObjectURL(url);
      };
    }
  }, [videoBlob]);

  // Handle file selection for upload
  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setLocalVideoUrl(url);
      setVideoBlob(file);
      if (onVideoRecorded) {
        onVideoRecorded(file);
      }
    }
  };

  // Handle video upload to server
  const handleUpload = async () => {
    if (!videoBlob) return;
    setIsUploading(true);
    try {
      if (onVideoUploaded) {
        await onVideoUploaded(episodeId, segmentId, videoBlob);
      }
    } catch (err) {
      console.error('Error uploading video:', err);
    } finally {
      setIsUploading(false);
    }
  };

  // Trigger file input click
  const handleBrowseClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  return (
    <Box sx={{ mt: 2 }}>
      {error && (
        <Typography color="error" variant="body2" sx={{ mb: 2 }}>
          Error: {error}
        </Typography>
      )}

      {/* Live video preview while recording */}
      <LiveVideoPreview isActive={!videoBlob && !localVideoUrl} stream={mediaStream} />

      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        {!videoBlob && !localVideoUrl ? (
          <>
            <IconButton
              color={isRecording ? 'error' : 'primary'}
              onClick={isRecording ? stopRecording : startRecording}
              disabled={isUploading || !isStreamReady}
              sx={{ mr: 1 }}
            >
              {isRecording ? <StopIcon /> : <VideocamIcon />}
            </IconButton>

            <Typography variant="body1">
              {isRecording ? 'Recording... Click to stop' : 'Click to start recording'}
            </Typography>

            <Typography variant="body2" sx={{ mx: 2 }}>
              or
            </Typography>

            <Button
              variant="outlined"
              onClick={handleBrowseClick}
              disabled={isRecording || isUploading}
              startIcon={<CloudUploadIcon />}
            >
              Upload Video
            </Button>

            <input
              type="file"
              ref={fileInputRef}
              style={{ display: 'none' }}
              accept="video/*"
              onChange={handleFileSelect}
            />
          </>
        ) : (
          <Button
            variant="contained"
            color="primary"
            onClick={handleUpload}
            disabled={isUploading}
            startIcon={isUploading ? <CircularProgress size={24} color="inherit" /> : null}
          >
            {isUploading ? 'Uploading...' : 'Save & Process'}
          </Button>
        )}
      </Box>

      {(videoBlob || localVideoUrl) && (
        <Box sx={{ mt: 2, maxWidth: '100%', width: '640px' }}>
          <VideoPlayer videoUrl={localVideoUrl} />
        </Box>
      )}

      {/* Camera selection dropdown */}
      {cameras.length > 1 && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="body2" sx={{ mb: 1 }}>Select Camera:</Typography>
          <select
            value={selectedCameraId}
            onChange={e => setSelectedCameraId(e.target.value)}
            style={{ padding: '6px 12px', fontSize: '1rem', borderRadius: 4 }}
            disabled={isRecording || isUploading}
          >
            {cameras.map(cam => (
              <option key={cam.deviceId} value={cam.deviceId}>{cam.label || `Camera ${cam.deviceId}`}</option>
            ))}
          </select>
        </Box>
      )}
    </Box>
  );
};

export default VideoRecorder; 