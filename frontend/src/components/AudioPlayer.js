import React, { useEffect, useRef, useState, memo } from 'react';
import { Box, IconButton, CircularProgress } from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import WaveSurfer from 'wavesurfer.js';

const AudioPlayer = ({ audioUrl, onReady, compact = false }) => {
  const audioRef = useRef(null);
  const waveformRef = useRef(null);
  const wavesurferRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [duration, setDuration] = useState(0);
  const [waveformError, setWaveformError] = useState(false);

  useEffect(() => {
    // Reset state when url changes
    setIsLoaded(false);
    setIsPlaying(false);
    setIsLoading(true);
    setWaveformError(false);
    
    console.log('AudioPlayer: URL changed', { audioUrl });
    
    // If audio element exists, load the new URL
    if (audioRef.current) {
      const audio = audioRef.current;
      
      const handleLoadedMetadata = () => {
        console.log('AudioPlayer: loadedmetadata', { duration: audio.duration });
        // For WAV files, we might get Infinity duration but still want to proceed
        if (audio.duration && (audio.duration === Infinity || !isNaN(audio.duration))) {
          setIsLoaded(true);
          setIsLoading(false);
          setDuration(audio.duration);
          if (onReady) onReady(audio.duration);
        }
      };
      
      const handleCanPlayThrough = () => {
        console.log('AudioPlayer: canplaythrough', { duration: audio.duration });
        // For WAV files, we might get Infinity duration but still want to proceed
        if (!isLoaded && audio.duration && (audio.duration === Infinity || !isNaN(audio.duration))) {
          setIsLoaded(true);
          setIsLoading(false);
          setDuration(audio.duration);
          if (onReady) onReady(audio.duration);
        }
      };
      
      const handleEnded = () => {
        console.log('AudioPlayer: ended');
        setIsPlaying(false);
      };
      
      const handleError = (e) => {
        console.error('AudioPlayer: error loading audio', e);
        setIsLoading(false);
      };
      
      // Add event listeners
      audio.addEventListener('loadedmetadata', handleLoadedMetadata);
      audio.addEventListener('canplaythrough', handleCanPlayThrough);
      audio.addEventListener('ended', handleEnded);
      audio.addEventListener('error', handleError);
      
      // Load the audio
      audio.load();
      
      // Clean up
      return () => {
        audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
        audio.removeEventListener('canplaythrough', handleCanPlayThrough);
        audio.removeEventListener('ended', handleEnded);
        audio.removeEventListener('error', handleError);
      };
    }
  }, [audioUrl, onReady]);

  // Initialize WaveSurfer when component mounts
  useEffect(() => {
    if (!waveformRef.current || !audioUrl) return;
    
    console.log('AudioPlayer: initializing WaveSurfer', { audioUrl, isLoaded });
    
    // Clean up previous instance
    if (wavesurferRef.current) {
      wavesurferRef.current.destroy();
      wavesurferRef.current = null;
    }
    
    try {
      // Create and configure WaveSurfer
      const wavesurfer = WaveSurfer.create({
        container: waveformRef.current,
        waveColor: '#99c0fa',
        progressColor: '#2196f3',
        cursorColor: '#2c5282',
        barWidth: 2,
        barRadius: 2,
        barGap: 1,
        responsive: true,
        height: 20,
        normalize: true,
        hideScrollbar: true,
        barMinHeight: 1,
        url: audioUrl // Directly load from URL
      });
      
      wavesurferRef.current = wavesurfer;
      
      // Set up event handlers
      wavesurfer.on('ready', () => {
        console.log('WaveSurfer: ready');
        // If we don't have a valid duration yet, try to get it from WaveSurfer
        if (!duration || isNaN(duration) || !isFinite(duration)) {
          const wsDuration = wavesurfer.getDuration();
          if (wsDuration && !isNaN(wsDuration) && isFinite(wsDuration)) {
            setDuration(wsDuration);
            if (onReady) onReady(wsDuration);
          }
        }
      });
      
      wavesurfer.on('error', (err) => {
        console.error('WaveSurfer: error', err);
        setWaveformError(true);
      });
      
      wavesurfer.on('play', () => {
        console.log('WaveSurfer: play');
        setIsPlaying(true);
        // Pause HTML5 audio to avoid conflicts
        if (audioRef.current && !audioRef.current.paused) {
          audioRef.current.pause();
        }
      });
      
      wavesurfer.on('pause', () => {
        console.log('WaveSurfer: pause');
        setIsPlaying(false);
      });
      
      wavesurfer.on('finish', () => {
        console.log('WaveSurfer: finish');
        setIsPlaying(false);
      });
      
      // Clean up on unmount
      return () => {
        if (wavesurferRef.current) {
          wavesurferRef.current.destroy();
          wavesurferRef.current = null;
        }
      };
    } catch (error) {
      console.error('Error initializing WaveSurfer:', error);
      setWaveformError(true);
    }
  }, [audioUrl, isLoaded, duration, onReady]);

  const togglePlayPause = () => {
    if (!audioRef.current || !isLoaded) return;
    
    // If waveform is available and not in error state, use it for playback
    if (wavesurferRef.current && !waveformError) {
      wavesurferRef.current.playPause();
      return;
    }
    
    // Fallback to regular audio element
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play()
        .then(() => setIsPlaying(true))
        .catch(err => console.error('Error playing audio:', err));
    }
  };

  const handleReset = () => {
    if (wavesurferRef.current && !waveformError) {
      wavesurferRef.current.seekTo(0);
      if (isPlaying) {
        wavesurferRef.current.play();
      }
    } else if (audioRef.current) {
      audioRef.current.currentTime = 0;
    }
  };
  
  // Format duration as mm:ss
  const formatTime = (seconds) => {
    if (!seconds || isNaN(seconds) || !isFinite(seconds)) return '0:00';
    const min = Math.floor(seconds / 60);
    const sec = Math.floor(seconds % 60);
    return `${min}:${sec < 10 ? '0' : ''}${sec}`;
  };

  if (!audioUrl) {
    return null;
  }

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', maxWidth: '200px' }}>
      {/* Play/pause button */}
      <IconButton 
        onClick={togglePlayPause} 
        disabled={!isLoaded || isLoading}
        size={compact ? "small" : "medium"}
        color={isPlaying ? "primary" : "default"}
        sx={{ mr: 0.5 }}
      >
        {isLoading ? <CircularProgress size={compact ? 18 : 24} /> : 
         isPlaying ? <PauseIcon fontSize={compact ? "small" : "medium"} /> : 
                    <PlayArrowIcon fontSize={compact ? "small" : "medium"} />}
      </IconButton>
      
      {/* Duration */}
      <Box component="span" sx={{
        fontSize: '0.7rem', 
        color: 'text.secondary',
        minWidth: '28px',
        visibility: isLoaded && !isLoading && duration && !isNaN(duration) && isFinite(duration) ? 'visible' : 'hidden'
      }}>
        {formatTime(duration)}
      </Box>
      
      {/* Waveform - always visible */}
      <Box sx={{ 
        flex: 1, 
        minWidth: '50px', 
        maxWidth: '100px',
        height: compact ? '18px' : '22px', 
        bgcolor: 'rgba(0,0,0,0.02)', 
        borderRadius: 1, 
        mx: 0.5,
        overflow: 'hidden'
      }}>
        {isLoaded && !waveformError && (
          <Box ref={waveformRef} sx={{ width: '100%', height: '100%' }} />
        )}
      </Box>
      
      {/* Reset button - always visible */}
      <IconButton 
        size="small"
        onClick={handleReset}
        disabled={!isLoaded || isLoading}
        sx={{ p: compact ? '1px' : '2px' }}
      >
        <RestartAltIcon fontSize={compact ? "small" : "medium"} />
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