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
  onPlay
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
    if (segment.audio_path) {
      const audioUrl = getAudioUrl(segment.audio_path);
      console.log('Audio URL:', { segmentType: segment.segment_type, audioPath: segment.audio_path, fullUrl: audioUrl });
      onPlay(audioUrl);
    }
  };

  return (
    <Card sx={{ 
      mb: 0, 
      position: 'relative',
      transition: 'box-shadow 0.2s ease-in-out',
      '&:hover': {
        boxShadow: 3,
        '& .drag-handle': {
          opacity: 1,
        }
      },
      boxShadow: isDragging ? 6 : 1,
    }}>
      {isLoading && (
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(255, 255, 255, 0.7)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 2,
          }}
        >
          <CircularProgress />
        </Box>
      )}
      
      {/* Drag handle indicator */}
      <Box 
        className="drag-handle"
        sx={{ 
          position: 'absolute', 
          left: 0, 
          top: 0, 
          bottom: 0, 
          width: '20px', 
          display: 'flex', 
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'rgba(0,0,0,0.03)',
          opacity: 0.3,
          transition: 'opacity 0.2s ease',
          cursor: 'grab',
          '&:active': {
            cursor: 'grabbing',
          }
        }}
        {...dragHandleProps}
      >
        <DragIndicatorIcon fontSize="small" color="action" />
      </Box>
      
      <CardContent sx={{ pl: '24px', py: 1.5 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Chip
              icon={segment.segment_type === 'human' ? <PersonIcon /> : <SmartToyIcon />}
              label={segment.segment_type === 'human' ? 'Human' : 'AI'}
              color={segment.segment_type === 'human' ? 'primary' : 'secondary'}
              size="small"
              sx={{ mr: 1 }}
            />
            <Typography variant="caption" color="text.secondary">
              {`#${segment.order_index + 1}`}
            </Typography>
          </Box>
          
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', minWidth: '160px', maxWidth: '220px' }}>
            {segment.audio_path && !isGenerating ? (
              <WaveformPlayer 
                segments={[{
                  ...segment,
                  audio_path: getAudioUrl(segment.audio_path)
                }]} 
                fullWidth={false}
              />
            ) : isGenerating ? (
              <Box sx={{ display: 'flex', alignItems: 'center', mr: 1 }}>
                <CircularProgress size={18} sx={{ mr: 0.5 }} />
                <Typography variant="caption" color="text.secondary">
                  Generating...
                </Typography>
              </Box>
            ) : null}
            
            <IconButton
              size="small"
              color="error"
              onClick={handleDeleteSegment}
              disabled={isLoading}
            >
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Box>
        </Box>
        
        <Box sx={{ mt: 0, px: 0.5 }}>
          <Typography 
            variant="body1" 
            sx={{ 
              whiteSpace: 'pre-wrap',
              minHeight: '30px',
              backgroundColor: '#f5f5f5',
              p: 1.5,
              borderRadius: 1,
              fontSize: '0.95rem',
              lineHeight: 1.5
            }}
            onClick={() => {
              // Open the text editor when clicking on the text
              const customEvent = new CustomEvent('editSegment', { detail: { segmentId: segment.id } });
              document.dispatchEvent(customEvent);
            }}
          >
            {segment.text_content || 'No text available.'}
          </Typography>
        </Box>
        
        {error && (
          <Typography color="error" sx={{ mt: 1, fontSize: '0.8rem' }}>
            {error}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
};

// Export a memoized version to prevent unnecessary re-renders
export default memo(SegmentItem); 