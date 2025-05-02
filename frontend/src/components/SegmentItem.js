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

  // Helper to generate speech with the latest text
  const handleGenerateSpeechWithText = async (text) => {
    if (!text) return;
    
    try {
      // Update state to show generation is in progress
      setIsGenerating(true);
      setError(null);
      
      // Use the updated API to generate speech
      const response = await generateSpeech(text, episodeId, segment.id);
      
      if (response.data.success) {
        // Segment has been updated in the database by the backend
        // Get the updated data from the response
        const updatedSegment = {
          ...segment,
          audio_path: response.data.file_path,
          text_content: text,
          isGeneratingSpeech: false
        };
        
        // Notify parent with updated data
        if (onUpdate) {
          onUpdate(updatedSegment);
        }
      } else {
        // Show the specific error message from the backend
        const errorMessage = response.data.message || 'Failed to generate speech';
        setError(`Speech generation failed: ${errorMessage}`);
        throw new Error(errorMessage);
      }
    } catch (err) {
      const errorMessage = err.response?.data?.message || err.message || 'Unknown error';
      setError(`Failed to generate speech: ${errorMessage}`);
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