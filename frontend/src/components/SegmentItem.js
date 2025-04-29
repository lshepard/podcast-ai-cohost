import React, { useState } from 'react';
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
import AudioPlayer from './AudioPlayer';
import TextEditor from './TextEditor';
import { updateSegment, deleteSegment, generateSpeech } from '../services/api';

const SegmentItem = ({ 
  segment, 
  episodeId, 
  onDelete, 
  onUpdate, 
  apiBaseUrl 
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState(null);

  const handleTextSave = async (newText) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await updateSegment(episodeId, segment.id, {
        text_content: newText
      });
      
      if (onUpdate) {
        onUpdate(response.data);
      }
    } catch (err) {
      setError('Failed to update text');
      console.error('Error updating segment text:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateSpeech = async () => {
    if (!segment.text_content) return;
    
    setIsGenerating(true);
    setError(null);
    
    try {
      // For bot segments, generate speech from text
      if (segment.segment_type === 'bot') {
        const outputPath = `/episodes/${episodeId}/segments/${segment.id}.mp3`;
        
        await generateSpeech(segment.text_content, outputPath);
        
        // Update segment with new audio path
        const updatedSegment = {
          ...segment,
          audio_path: outputPath
        };
        
        const response = await updateSegment(episodeId, segment.id, updatedSegment);
        
        if (onUpdate) {
          onUpdate(response.data);
        }
      }
    } catch (err) {
      setError('Failed to generate speech');
      console.error('Error generating speech:', err);
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

  const getAudioUrl = () => {
    if (!segment.audio_path) return null;
    
    // Check if it's a full URL or a relative path
    if (segment.audio_path.startsWith('http')) {
      return segment.audio_path;
    }
    
    // Construct URL from API base and path
    return `${apiBaseUrl}${segment.audio_path}`;
  };

  return (
    <Card sx={{ mb: 2, position: 'relative' }}>
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
      
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
          <Chip
            icon={segment.segment_type === 'human' ? <PersonIcon /> : <SmartToyIcon />}
            label={segment.segment_type === 'human' ? 'Human' : 'AI'}
            color={segment.segment_type === 'human' ? 'primary' : 'secondary'}
            size="small"
          />
          
          <IconButton
            size="small"
            color="error"
            onClick={handleDeleteSegment}
            disabled={isLoading}
          >
            <DeleteIcon />
          </IconButton>
        </Box>
        
        <TextEditor
          text={segment.text_content}
          onSave={handleTextSave}
          readOnly={false}
          title={segment.segment_type === 'human' ? 'Transcription' : 'AI Response'}
          isGenerating={isGenerating}
          onGenerateRequest={
            segment.segment_type === 'bot' ? handleGenerateSpeech : undefined
          }
        />
        
        {segment.audio_path && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              Audio
            </Typography>
            <AudioPlayer audioUrl={getAudioUrl()} />
          </Box>
        )}
        
        {error && (
          <Typography color="error" sx={{ mt: 2 }}>
            {error}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
};

export default SegmentItem; 