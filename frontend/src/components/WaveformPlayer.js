import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { Box, Paper, Typography, CircularProgress, IconButton, Stack } from '@mui/material';
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

const WaveformPlayer = ({ segments, fullWidth = false }) => {
  const containerRef = useRef(null);
  const wavesurferRef = useRef(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentSegmentIndex, setCurrentSegmentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

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
    }
  }, [currentSegmentIndex, audioSegments.length]);

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
        setCurrentTime(wavesurfer.getCurrentTime());
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
  }, [currentAudioUrl, handleSegmentEnd]);

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
      wavesurferRef.current.playPause();
    }
  }, []);

  const handleRestart = useCallback(() => {
    if (wavesurferRef.current) {
      wavesurferRef.current.seekTo(0);
      wavesurferRef.current.play();
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
          {formatTime(currentTime)} / {formatTime(duration)}
        </Typography>
        {audioSegments.length > 1 && (
          <Typography variant="body2" color="text.secondary">
            Segment {currentSegmentIndex + 1} of {audioSegments.length}
          </Typography>
        )}
      </Stack>
      <Box ref={containerRef} sx={{ width: fullWidth ? '100%' : '50%', height: 25 }} />
      {isLoading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
          <CircularProgress />
        </Box>
      )}
      {error && (
        <Typography color="error">{error}</Typography>
      )}
    </Stack>
  );
};

export default WaveformPlayer; 