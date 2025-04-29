import React, { useEffect, useRef, useState } from 'react';
import { Box, IconButton, CircularProgress } from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import WaveSurfer from 'wavesurfer.js';

const AudioPlayer = ({ audioUrl, onReady }) => {
  const waveformRef = useRef(null);
  const wavesurferRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const abortControllerRef = useRef(null);

  useEffect(() => {
    let isMounted = true;
    abortControllerRef.current = new AbortController();
    
    // Clear any previous instance
    if (wavesurferRef.current) {
      try {
        wavesurferRef.current.destroy();
      } catch (e) {
        console.error("Error destroying previous WaveSurfer instance:", e);
      }
      wavesurferRef.current = null;
    }

    if (!audioUrl || !waveformRef.current) return;

    setIsLoading(true);
    setIsLoaded(false);

    // Delay initialization to avoid race conditions
    const initTimeout = setTimeout(() => {
      try {
        if (!isMounted) return;
        
        // Create WaveSurfer instance with options
        const wavesurfer = WaveSurfer.create({
          container: waveformRef.current,
          waveColor: '#4a9eff',
          progressColor: '#1e5180',
          cursorColor: '#333',
          barWidth: 2,
          barRadius: 3,
          responsive: true,
          height: 80,
          normalize: true,
          backend: 'MediaElement' // Try using MediaElement backend for better stability
        });
        
        wavesurferRef.current = wavesurfer;
        
        // Set up event handlers
        wavesurfer.on('ready', () => {
          if (isMounted) {
            setIsLoaded(true);
            setIsLoading(false);
            if (onReady) onReady(wavesurfer.getDuration());
          }
        });
        
        wavesurfer.on('error', (err) => {
          console.error('WaveSurfer error:', err);
          if (isMounted) {
            setIsLoading(false);
          }
        });
        
        wavesurfer.on('play', () => {
          if (isMounted) setIsPlaying(true);
        });
        
        wavesurfer.on('pause', () => {
          if (isMounted) setIsPlaying(false);
        });
        
        wavesurfer.on('finish', () => {
          if (isMounted) setIsPlaying(false);
        });
        
        // Delayed loading to avoid abort errors
        setTimeout(() => {
          if (isMounted && wavesurferRef.current) {
            try {
              wavesurferRef.current.load(audioUrl);
            } catch (err) {
              console.error('Error loading audio:', err);
              if (isMounted) setIsLoading(false);
            }
          }
        }, 50);
      } catch (error) {
        console.error("Error initializing WaveSurfer:", error);
        if (isMounted) setIsLoading(false);
      }
    }, 100);
    
    // Cleanup function
    return () => {
      isMounted = false;
      clearTimeout(initTimeout);
      
      // Cancel any pending operations
      if (abortControllerRef.current) {
        try {
          abortControllerRef.current.abort();
        } catch (e) {
          console.error("Error aborting:", e);
        }
      }
      
      // Wait a bit before destroying WaveSurfer to prevent abort errors
      setTimeout(() => {
        if (wavesurferRef.current) {
          try {
            wavesurferRef.current.destroy();
          } catch (e) {
            console.error("Error destroying WaveSurfer:", e);
          }
          wavesurferRef.current = null;
        }
      }, 50);
    };
  }, [audioUrl, onReady]);

  const togglePlayPause = () => {
    if (wavesurferRef.current && isLoaded) {
      try {
        wavesurferRef.current.playPause();
      } catch (e) {
        console.error("Error toggling play/pause:", e);
      }
    }
  };

  if (!audioUrl) {
    return null;
  }

  return (
    <Box sx={{ width: '100%', mt: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center' }}>
        <IconButton 
          onClick={togglePlayPause} 
          sx={{ mr: 1 }}
          disabled={!isLoaded || isLoading}
        >
          {isLoading ? <CircularProgress size={24} /> : 
           isPlaying ? <PauseIcon /> : <PlayArrowIcon />}
        </IconButton>
        
        <Box ref={waveformRef} sx={{ flex: 1 }} />
      </Box>
    </Box>
  );
};

export default AudioPlayer; 