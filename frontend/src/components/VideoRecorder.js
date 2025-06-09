import React, { useState } from 'react';
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
  const { isRecording, videoBlob, error, startRecording, stopRecording, setVideoBlob } = useVideoRecorder();
  const [isUploading, setIsUploading] = useState(false);
  const [localVideoUrl, setLocalVideoUrl] = useState(null);
  const fileInputRef = React.useRef(null);

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
      <LiveVideoPreview isActive={isRecording} />

      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        {!videoBlob && !localVideoUrl ? (
          <>
            <IconButton
              color={isRecording ? 'error' : 'primary'}
              onClick={isRecording ? stopRecording : startRecording}
              disabled={isUploading}
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
    </Box>
  );
};

export default VideoRecorder; 