import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Box, Paper, Typography, CircularProgress } from '@mui/material';
import WaveSurfer from 'wavesurfer.js';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

const EpisodeWaveform = ({ segments }) => {
  const containerRef = useRef(null);
  const wavesurferRef = useRef(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // Check if there are any segments with audio
  const hasAudioSegments = segments?.some(segment => segment.audio_path);
  console.log('EpisodeWaveform: Initial render', {
    segments,
    hasAudioSegments,
    segmentsWithAudio: segments?.filter(s => s.audio_path).map(s => ({ id: s.id, audio_path: s.audio_path }))
  });

  const initializeWaveSurfer = useCallback(async () => {
    if (!containerRef.current || !hasAudioSegments || isInitialized) {
      console.log('EpisodeWaveform: Skipping initialization', {
        hasContainer: !!containerRef.current,
        hasAudioSegments,
        isInitialized
      });
      return;
    }

    try {
      console.log('EpisodeWaveform: Initializing WaveSurfer');
      wavesurferRef.current = WaveSurfer.create({
        container: containerRef.current,
        waveColor: '#4a74a8',
        progressColor: '#2c5282',
        cursorColor: '#2c5282',
        barWidth: 2,
        barRadius: 3,
        cursorWidth: 1,
        height: 100,
        barGap: 3,
      });

      setIsLoading(true);
      setError(null);
      console.log('EpisodeWaveform: Starting audio load sequence');

      // Create a temporary audio context to analyze the files
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      let currentTime = 0;

      // Process each segment
      for (const segment of segments) {
        if (!segment.audio_path) {
          console.log(`EpisodeWaveform: Skipping segment ${segment.id} - no audio path`);
          continue;
        }

        try {
          const fullAudioPath = `${API_URL}${segment.audio_path}`;
          console.log(`EpisodeWaveform: Loading audio for segment ${segment.id}`, {
            segmentId: segment.id,
            audioPath: segment.audio_path,
            fullPath: fullAudioPath,
            currentTime
          });
          
          const response = await fetch(fullAudioPath);
          if (!response.ok) {
            throw new Error(`Failed to load audio: ${response.status}`);
          }
          
          const arrayBuffer = await response.arrayBuffer();
          console.log(`EpisodeWaveform: Decoding audio for segment ${segment.id}`);
          const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
          console.log(`EpisodeWaveform: Audio decoded for segment ${segment.id}`, {
            duration: audioBuffer.duration,
            sampleRate: audioBuffer.sampleRate,
            numberOfChannels: audioBuffer.numberOfChannels
          });

          // Add the audio to the waveform
          console.log(`EpisodeWaveform: Adding audio to waveform for segment ${segment.id} at time ${currentTime}`);
          wavesurferRef.current.addAudioBuffer(audioBuffer, currentTime);
          currentTime += audioBuffer.duration;
          console.log(`EpisodeWaveform: Segment ${segment.id} added successfully, new currentTime: ${currentTime}`);
        } catch (err) {
          console.error(`EpisodeWaveform: Error loading segment ${segment.id}:`, err);
        }
      }

      // Finalize the waveform
      console.log('EpisodeWaveform: Finalizing waveform', { totalDuration: currentTime });
      wavesurferRef.current.setDuration(currentTime);
      wavesurferRef.current.zoom(0.5);
      console.log('EpisodeWaveform: Waveform finalized successfully');
      setIsInitialized(true);
    } catch (err) {
      console.error('EpisodeWaveform: Error in initialization:', err);
      setError('Failed to initialize waveform');
    } finally {
      setIsLoading(false);
    }
  }, [segments, hasAudioSegments, isInitialized]);

  // Handle initialization
  useEffect(() => {
    initializeWaveSurfer();

    // Cleanup
    return () => {
      console.log('EpisodeWaveform: Cleanup - destroying WaveSurfer instance');
      if (wavesurferRef.current) {
        wavesurferRef.current.destroy();
      }
      setIsInitialized(false);
    };
  }, [initializeWaveSurfer]);

  if (!hasAudioSegments) {
    console.log('EpisodeWaveform: No audio segments, returning null');
    return null;
  }

  return (
    <Paper sx={{ p: 3, mb: 3 }}>
      <Typography variant="h6" gutterBottom>
        Episode Waveform
      </Typography>
      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
          <CircularProgress />
        </Box>
      ) : error ? (
        <Typography color="error">{error}</Typography>
      ) : (
        <Box ref={containerRef} sx={{ width: '100%' }} />
      )}
    </Paper>
  );
};

export default EpisodeWaveform; 