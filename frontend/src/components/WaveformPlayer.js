import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { Box, Typography, CircularProgress, IconButton, Stack } from '@mui/material';
import WaveSurfer from 'wavesurfer.js';
import RegionsPlugin from 'wavesurfer.js/plugins/regions';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import { getAudioUrl } from '../utils/audio';

const SEGMENT_COLORS = {
  human: '#4a74a8', // blue
  bot: '#e91e63',   // pink
};

const formatTime = (seconds) => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
};

const WaveformPlayer = ({ segments, fullWidth = false, segmentId, playNext, playAllEnabled = false }) => {
  const containerRef = useRef(null);
  const wavesurferRef = useRef(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentSegmentIndex, setCurrentSegmentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);

  // Get segments with audio using useMemo to prevent unnecessary recalculations
  const audioSegments = useMemo(() => {
    if (!segments) return [];
    return segments
      .filter(segment => segment.audio_path)
      .map(segment => ({
        ...segment,
        normalizedUrl: segment.audio_path.startsWith('http') ? segment.audio_path : getAudioUrl(segment.audio_path)
      }));
  }, [segments]);

  const currentSegment = audioSegments[currentSegmentIndex];
  const currentAudioUrl = currentSegment?.normalizedUrl;

  // Handle segment navigation using useCallback to prevent unnecessary recreations
  const handleSegmentEnd = useCallback(() => {
    if (currentSegmentIndex < audioSegments.length - 1) {
      setCurrentSegmentIndex(prev => prev + 1);
    } else if (playAllEnabled && playNext) {
      // If this is the last segment and play all is enabled, call the playNext callback
      console.log('Segment finished, calling playNext callback');
      playNext();
    }
  }, [currentSegmentIndex, audioSegments.length, playAllEnabled, playNext]);

  // Initialize WaveSurfer when component mounts or audio URL changes
  useEffect(() => {
    let isActive = true;
    
    if (!containerRef.current || !currentAudioUrl) return;
    
    // Log container dimensions
    const containerWidth = containerRef.current.clientWidth;
    const containerHeight = containerRef.current.clientHeight;
    console.log('Waveform container dimensions:', { width: containerWidth, height: containerHeight });
    
    // Clean up previous instance
    if (wavesurferRef.current) {
      try {
        wavesurferRef.current.destroy();
      } catch (err) {
        console.warn('Error cleaning up previous WaveSurfer instance:', err);
      }
      wavesurferRef.current = null;
    }
    
    try {
      // Create and configure WaveSurfer
      const wavesurfer = WaveSurfer.create({
        container: containerRef.current,
        waveColor: SEGMENT_COLORS[currentSegment?.segment_type] || '#4a74a8',
        progressColor: '#2c5282',
        cursorColor: '#2c5282',
        barWidth: 2,
        barRadius: 3,
        cursorWidth: 1,
        barGap: 3,
        height: 25,
        minPxPerSec: 1,
        normalize: true,
        plugins: [
          RegionsPlugin.create({
            dragSelection: false,
          }),
        ],
        url: currentAudioUrl
      });
      
      if (!isActive) {
        wavesurfer.destroy();
        return;
      }
      
      wavesurferRef.current = wavesurfer;
      
      // Set up event handlers
      wavesurfer.on('ready', () => {
        if (!isActive) return;
        const duration = wavesurfer.getDuration();
        console.log('WaveSurfer: Ready', { 
          segmentId: currentSegment?.id,
          url: currentAudioUrl,
          duration,
          containerWidth,
          containerHeight
        });
        setDuration(duration);
        setIsLoading(false);
        
        // Auto-play if playAllEnabled is true
        if (playAllEnabled) {
          try {
            wavesurfer.play()
              .catch(err => {
                // Ignore AbortError which commonly happens when play is interrupted
                if (err.name !== 'AbortError') {
                  console.error('Error playing audio:', err);
                }
              });
          } catch (err) {
            console.warn('Error during auto-play:', err);
          }
        }
      });

      wavesurfer.on('error', (err) => {
        if (!isActive) return;
        console.error('WaveSurfer: Error', err, {
          url: currentAudioUrl,
          segmentId: currentSegment?.id,
          stack: err.stack,
          containerWidth,
          containerHeight
        });
        setError('Failed to load audio');
      });

      wavesurfer.on('finish', handleSegmentEnd);
      wavesurfer.on('audioprocess', () => {
        if (!isActive) return;
      });
      wavesurfer.on('play', () => {
        if (!isActive) return;
        setIsPlaying(true);
      });
      wavesurfer.on('pause', () => {
        if (!isActive) return;
        setIsPlaying(false);
      });

    } catch (error) {
      if (!isActive) return;
      console.error('Error initializing WaveSurfer:', error, {
        segmentId: currentSegment?.id,
        url: currentAudioUrl,
        stack: error.stack,
        containerWidth,
        containerHeight
      });
      setError('Failed to initialize audio player');
    }

    // Clean up on unmount
    return () => {
      isActive = false;
      if (wavesurferRef.current) {
        try {
          wavesurferRef.current.destroy();
        } catch (err) {
          console.warn('Error destroying WaveSurfer on cleanup:', err);
        }
        wavesurferRef.current = null;
      }
    };
  }, [currentAudioUrl, handleSegmentEnd, currentSegment?.id, currentSegment?.segment_type, playAllEnabled]);

  // Add effect to handle playAllEnabled changes for already initialized player
  useEffect(() => {
    if (wavesurferRef.current && !isLoading) {
      if (playAllEnabled) {
        console.log('Auto-playing segment because playAllEnabled became true');
        try {
          wavesurferRef.current.play()
            .catch(err => {
              // Ignore AbortError which commonly happens when play is interrupted
              if (err.name !== 'AbortError') {
                console.error('Error playing audio:', err);
              }
            });
        } catch (err) {
          console.warn('Error during auto-play:', err);
        }
      } else {
        // Pause if play all is disabled
        try {
          wavesurferRef.current.pause();
        } catch (err) {
          console.warn('Error pausing audio:', err);
        }
      }
    }
  }, [playAllEnabled, isLoading]);

  // Setup regions when segments change
  useEffect(() => {
    if (!wavesurferRef.current || !audioSegments.length) return;

    const wavesurfer = wavesurferRef.current;
    const regionsPlugin = wavesurfer.getActivePlugins().find(p => p instanceof RegionsPlugin);
    if (!regionsPlugin) return;

    // Clear existing regions
    try {
      regionsPlugin.clearRegions();
    } catch (err) {
      console.warn('Error clearing regions:', err);
    }
    
    // Add regions with proper timing
    let startTime = 0;
    audioSegments.forEach((segment) => {
      try {
        regionsPlugin.addRegion({
          id: `segment-${segment.id}`,
          start: startTime,
          end: startTime + wavesurfer.getDuration(),
          color: `${SEGMENT_COLORS[segment.segment_type]}33`,
          drag: false,
          resize: false,
        });
        startTime += wavesurfer.getDuration();
      } catch (err) {
        console.warn('Error adding region:', err);
      }
    });

    return () => {
      if (regionsPlugin) {
        try {
          regionsPlugin.clearRegions();
        } catch (err) {
          console.warn('Error cleaning up regions:', err);
        }
      }
    };
  }, [audioSegments]);

  // Handle playback controls
  const handlePlayPause = useCallback(() => {
    if (wavesurferRef.current) {
      try {
        if (wavesurferRef.current.isPlaying()) {
          wavesurferRef.current.pause();
        } else {
          wavesurferRef.current.play()
            .catch(err => {
              // Ignore AbortError which commonly happens when play is interrupted
              if (err.name !== 'AbortError') {
                console.error('Error playing audio:', err);
              }
            });
        }
      } catch (err) {
        console.warn('Error toggling play/pause:', err);
      }
    }
  }, []);

  const handleRestart = useCallback(() => {
    if (wavesurferRef.current) {
      try {
        wavesurferRef.current.seekTo(0);
        wavesurferRef.current.play()
          .catch(err => {
            // Ignore AbortError which commonly happens when play is interrupted
            if (err.name !== 'AbortError') {
              console.error('Error playing audio after restart:', err);
            }
          });
      } catch (err) {
        console.warn('Error restarting audio:', err);
      }
    }
  }, []);

  if (!currentSegment) {
    return null;
  }

  return (
    <Stack direction="row" spacing={2} alignItems="center">
      <Stack direction="row" spacing={1} alignItems="center">
        <IconButton onClick={handlePlayPause} size="small">
          {isPlaying ? <PauseIcon /> : <PlayArrowIcon />}
        </IconButton>
        <IconButton onClick={handleRestart} size="small">
          <RestartAltIcon />
        </IconButton>
        <Typography variant="body2" color="text.secondary">
          {formatTime(duration)}
        </Typography>
        {audioSegments.length > 1 && (
          <Typography variant="body2" color="text.secondary">
            Segment {currentSegmentIndex + 1} of {audioSegments.length}
          </Typography>
        )}
      </Stack>
      <Box ref={containerRef} sx={{ width: fullWidth ? '100%' : '50%', minWidth: 200, height: 25 }} />
      {isLoading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
          <CircularProgress size={24} />
        </Box>
      )}
      {error && (
        <Typography variant="body2" color="error" sx={{ ml: 2 }}>
          {error}
        </Typography>
      )}
    </Stack>
  );
};

export default WaveformPlayer; 