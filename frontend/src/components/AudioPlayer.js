import React, { useEffect, useRef, useState, memo } from 'react';
import { Box, IconButton, CircularProgress } from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';

const AudioPlayer = ({ audioUrl, onReady, compact = false }) => {
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Reset state when url changes
    setIsLoaded(false);
    setIsPlaying(false);
    setIsLoading(true);
    
    // If audio element exists, load the new URL
    if (audioRef.current) {
      const audio = audioRef.current;
      
      const handleCanPlayThrough = () => {
        setIsLoaded(true);
        setIsLoading(false);
        if (onReady) onReady(audio.duration);
      };
      
      const handleEnded = () => {
        setIsPlaying(false);
      };
      
      const handleError = () => {
        console.error('Error loading audio');
        setIsLoading(false);
      };
      
      // Add event listeners
      audio.addEventListener('canplaythrough', handleCanPlayThrough);
      audio.addEventListener('ended', handleEnded);
      audio.addEventListener('error', handleError);
      
      // Load the audio
      audio.load();
      
      // Clean up
      return () => {
        audio.removeEventListener('canplaythrough', handleCanPlayThrough);
        audio.removeEventListener('ended', handleEnded);
        audio.removeEventListener('error', handleError);
      };
    }
  }, [audioUrl, onReady]);

  const togglePlayPause = () => {
    if (!audioRef.current || !isLoaded) return;
    
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play()
        .then(() => setIsPlaying(true))
        .catch(err => console.error('Error playing audio:', err));
    }
  };

  if (!audioUrl) {
    return null;
  }

  return (
    <Box sx={{ display: 'flex', alignItems: 'center' }}>
      <IconButton 
        onClick={togglePlayPause} 
        disabled={!isLoaded || isLoading}
        size={compact ? "small" : "medium"}
      >
        {isLoading ? <CircularProgress size={compact ? 18 : 24} /> : 
         isPlaying ? <PauseIcon fontSize={compact ? "small" : "medium"} /> : 
                    <PlayArrowIcon fontSize={compact ? "small" : "medium"} />}
      </IconButton>
      
      <audio 
        ref={audioRef}
        src={audioUrl}
        preload="auto"
        style={{ display: 'none' }}
      />
    </Box>
  );
};

export default memo(AudioPlayer); 