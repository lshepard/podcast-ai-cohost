import React, { useState, useEffect, memo } from 'react';
import {
  Box,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  IconButton,
  Typography,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import PersonIcon from '@mui/icons-material/Person';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import WaveformPlayer from './WaveformPlayer';
import { updateSegment, deleteSegment, generateSpeech } from '../services/api';
import { getAudioUrl } from '../utils/audio';

const SegmentItem = ({ 
  segment, 
  episodeId, 
  onDelete, 
  onUpdate, 
  apiBaseUrl,
  dragHandleProps,
  isDragging,
  onPlay,
  playNext,
  playAllEnabled
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState(null);

  // Add effect to handle external speech generation state
  useEffect(() => {
    setIsGenerating(segment.isGeneratingSpeech || false);
  }, [segment.isGeneratingSpeech]);

  const handleTextSave = async (newText) => {
    setIsLoading(true);
    setError(null);
    
    try {
      // First update just the text content
      const response = await updateSegment(episodeId, segment.id, {
        text_content: newText
      });
      
      if (onUpdate) {
        onUpdate(response.data);
      }
      
      // For bot segments, regenerate audio automatically but without blocking
      if (segment.segment_type === 'bot') {
        // Update local state to show generating status
        if (onUpdate) {
          onUpdate({
            ...response.data,
            isGeneratingSpeech: true
          });
        }
        
        // Generate speech in the background
        handleGenerateSpeechWithText(newText)
          .catch(err => {
            console.error('Background speech generation failed:', err);
          });
      }
    } catch (err) {
      setError('Failed to update text');
      console.error('Error updating segment text:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Helper to generate speech with the latest text
  const handleGenerateSpeechWithText = async (text) => {
    if (!text) return;
    
    try {
      // Update state to show generation is in progress
      setIsGenerating(true);
      setError(null);
      
      const outputPath = `/episodes/${episodeId}/segments/${segment.id}.mp3`;
      await generateSpeech(text, outputPath);
      
      // Update segment with new audio path
      const updatedSegment = {
        ...segment,
        audio_path: outputPath,
        text_content: text,
        isGeneratingSpeech: false
      };
      
      // Only update the audio_path in the database
      const response = await updateSegment(episodeId, segment.id, {
        audio_path: outputPath
      });
      
      // Notify parent with combined local and server data
      if (onUpdate) {
        onUpdate({
          ...response.data,
          isGeneratingSpeech: false
        });
      }
    } catch (err) {
      setError('Failed to generate speech');
      console.error('Error generating speech:', err);
      
      // Update state to remove loading state even if generation fails
      if (onUpdate) {
        onUpdate({
          ...segment,
          isGeneratingSpeech: false
        });
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateSpeech = async () => {
    if (!segment.text_content) return;
    
    try {
      setIsGenerating(true);
      setError(null);
      
      // For bot segments, generate speech from text
      if (segment.segment_type === 'bot') {
        // Update UI to show generating state
        if (onUpdate) {
          onUpdate({
            ...segment,
            isGeneratingSpeech: true
          });
        }
        
        const outputPath = `/episodes/${episodeId}/segments/${segment.id}.mp3`;
        await generateSpeech(segment.text_content, outputPath);
        
        // Update segment with new audio path
        const response = await updateSegment(episodeId, segment.id, {
          audio_path: outputPath
        });
        
        // Notify parent with combined data
        if (onUpdate) {
          onUpdate({
            ...response.data,
            isGeneratingSpeech: false
          });
        }
      }
    } catch (err) {
      setError('Failed to generate speech');
      console.error('Error generating speech:', err);
      
      // Update state to remove loading state even if generation fails
      if (onUpdate) {
        onUpdate({
          ...segment,
          isGeneratingSpeech: false
        });
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDeleteSegment = async () => {
    if (window.confirm('Are you sure you want to delete this segment?')) {
      setIsLoading(true);
      
      try {
        await deleteSegment(episodeId, segment.id);
        
        if (onDelete) {
          onDelete(segment.id);
        }
      } catch (err) {
        setError('Failed to delete segment');
        console.error('Error deleting segment:', err);
        setIsLoading(false);
      }
    }
  };

  const handlePlayClick = () => {
    if (segment.audio_path && onPlay) {
      onPlay();
    }
  };

  return (
    <Card sx={{ 
      mb: 2, 
      opacity: isDragging ? 0.5 : 1,
      backgroundColor: segment.segment_type === 'human' ? '#f5f9ff' : '#fdf5f9'
    }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          {dragHandleProps ? (
            <Box {...dragHandleProps} sx={{ mr: 1, cursor: 'grab' }}>
              <DragIndicatorIcon color="action" />
            </Box>
          ) : null}
          
          <Chip 
            icon={segment.segment_type === 'human' ? <PersonIcon /> : <SmartToyIcon />}
            label={segment.segment_type === 'human' ? 'Human' : 'AI'}
            color={segment.segment_type === 'human' ? 'primary' : 'secondary'}
            size="small"
            sx={{ mr: 1 }}
          />
          
          <Typography variant="body2" color="text.secondary">
            {segment.id}
          </Typography>
          
          <Box sx={{ flexGrow: 1 }} />
          
          <IconButton 
            onClick={handleDeleteSegment} 
            disabled={isLoading}
            color="error"
            size="small"
          >
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Box>
        
        <Box>
          <Typography 
            variant="body1" 
            component="div" 
            gutterBottom 
            sx={{ 
              whiteSpace: 'pre-wrap',
              cursor: 'pointer',
              p: 1,
              borderRadius: 1,
              '&:hover': {
                backgroundColor: 'rgba(0, 0, 0, 0.04)',
              }
            }}
            onClick={() => {
              // Dispatch custom event to trigger edit dialog
              const event = new CustomEvent('editSegment', {
                detail: { segmentId: segment.id }
              });
              document.dispatchEvent(event);
            }}
          >
            {segment.text_content || <em>No text content</em>}
          </Typography>
          
          {segment.audio_path && (
            <Box sx={{ mt: 2 }} onClick={handlePlayClick}>
              <WaveformPlayer 
                segments={[segment]} 
                segmentId={segment.id}
                playNext={playNext}
                playAllEnabled={playAllEnabled}
              />
            </Box>
          )}
          
          {isGenerating && (
            <Box sx={{ display: 'flex', alignItems: 'center', mt: 2 }}>
              <CircularProgress size={16} sx={{ mr: 1 }} />
              <Typography variant="body2" color="text.secondary">
                Generating audio...
              </Typography>
            </Box>
          )}
          
          {error && (
            <Typography color="error" variant="body2" sx={{ mt: 1 }}>
              {error}
            </Typography>
          )}
        </Box>
      </CardContent>
    </Card>
  );
};

// Export a memoized version to prevent unnecessary re-renders
export default memo(SegmentItem); 