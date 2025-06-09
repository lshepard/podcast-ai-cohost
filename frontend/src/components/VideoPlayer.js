import React, { useRef, useState } from 'react';
import { Box, IconButton, CircularProgress } from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import RestartAltIcon from '@mui/icons-material/RestartAlt';

const VideoPlayer = ({ videoUrl, onReady, compact = false }) => {
  const videoRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [duration, setDuration] = useState(0);

  // Handle video loading
  React.useEffect(() => {
    if (!videoRef.current || !videoUrl) return;
    
    setIsLoaded(false);
    setIsPlaying(false);
    setIsLoading(true);
    
    const video = videoRef.current;
    
    const handleLoadedMetadata = () => {
      setIsLoaded(true);
      setIsLoading(false);
      setDuration(video.duration);
      if (onReady) onReady(video.duration);
    };
    
    const handleEnded = () => {
      setIsPlaying(false);
    };
    
    const handleError = (e) => {
      console.error('Error loading video:', e);
      setIsLoading(false);
    };
    
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('ended', handleEnded);
    video.addEventListener('error', handleError);
    
    video.load();
    
    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('ended', handleEnded);
      video.removeEventListener('error', handleError);
    };
  }, [videoUrl, onReady]);

  const togglePlayPause = () => {
    if (!videoRef.current || !isLoaded) return;
    
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.play()
        .then(() => setIsPlaying(true))
        .catch(err => console.error('Error playing video:', err));
    }
  };

  const handleReset = () => {
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      if (isPlaying) {
        videoRef.current.play();
      }
    }
  };
  
  // Format duration as mm:ss
  const formatTime = (seconds) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const min = Math.floor(seconds / 60);
    const sec = Math.floor(seconds % 60);
    return `${min}:${sec < 10 ? '0' : ''}${sec}`;
  };

  if (!videoUrl) {
    return null;
  }

  return (
    <Box sx={{ position: 'relative', width: '100%' }}>
      <video 
        ref={videoRef}
        src={videoUrl}
        style={{ 
          width: '100%',
          maxHeight: '360px',
          backgroundColor: '#000',
        }}
      />
      
      <Box sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        mt: 1,
        gap: 1
      }}>
        <IconButton 
          onClick={togglePlayPause} 
          disabled={!isLoaded || isLoading}
          size={compact ? "small" : "medium"}
          color={isPlaying ? "primary" : "default"}
        >
          {isLoading ? <CircularProgress size={24} /> : 
           isPlaying ? <PauseIcon /> : <PlayArrowIcon />}
        </IconButton>
        
        <Box component="span" sx={{
          fontSize: '0.7rem', 
          color: 'text.secondary',
          minWidth: '28px',
          visibility: isLoaded && !isLoading && duration ? 'visible' : 'hidden'
        }}>
          {formatTime(duration)}
        </Box>
        
        <IconButton 
          size="small"
          onClick={handleReset}
          disabled={!isLoaded || isLoading}
        >
          <RestartAltIcon />
        </IconButton>
      </Box>
    </Box>
  );
};

export default VideoPlayer; 