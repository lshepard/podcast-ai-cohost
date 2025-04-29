import React, { useState } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  IconButton,
  Typography,
} from '@mui/material';
import MicIcon from '@mui/icons-material/Mic';
import StopIcon from '@mui/icons-material/Stop';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import useAudioRecorder from '../hooks/useAudioRecorder';
import AudioPlayer from './AudioPlayer';

const AudioRecorder = ({ onAudioRecorded, onAudioUploaded, episodeId, segmentId }) => {
  const { isRecording, audioBlob, error, startRecording, stopRecording } = useAudioRecorder();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [localAudioUrl, setLocalAudioUrl] = useState(null);
  const fileInputRef = React.useRef(null);

  // Handle recording stop
  const handleStopRecording = () => {
    stopRecording();
  };

  // When recording is completed and blob is available
  React.useEffect(() => {
    if (audioBlob) {
      const url = URL.createObjectURL(audioBlob);
      setLocalAudioUrl(url);
      
      // Cleanup when component unmounts
      return () => {
        URL.revokeObjectURL(url);
      };
    }
  }, [audioBlob]);

  // Handle file selection for upload
  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setLocalAudioUrl(url);
      
      if (onAudioRecorded) {
        onAudioRecorded(file);
      }
    }
  };

  // Handle audio upload to server
  const handleUpload = async () => {
    if (!audioBlob && !localAudioUrl) return;
    
    setIsUploading(true);
    
    try {
      // Call the onAudioUploaded callback with the audio blob
      if (onAudioUploaded) {
        await onAudioUploaded(audioBlob || localAudioUrl, episodeId, segmentId);
      }
    } catch (err) {
      console.error('Error uploading audio:', err);
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
      
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        {!audioBlob && !localAudioUrl ? (
          <>
            <IconButton
              color={isRecording ? 'error' : 'primary'}
              onClick={isRecording ? handleStopRecording : startRecording}
              disabled={isUploading}
              sx={{ mr: 1 }}
            >
              {isRecording ? <StopIcon /> : <MicIcon />}
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
              Upload Audio
            </Button>
            
            <input
              type="file"
              ref={fileInputRef}
              style={{ display: 'none' }}
              accept="audio/*"
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
            {isUploading ? 'Uploading...' : 'Save & Transcribe'}
          </Button>
        )}
      </Box>
      
      {(audioBlob || localAudioUrl) && (
        <AudioPlayer audioUrl={localAudioUrl} />
      )}
    </Box>
  );
};

export default AudioRecorder; 