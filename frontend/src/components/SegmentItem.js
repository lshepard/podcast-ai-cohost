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
import ArticleIcon from '@mui/icons-material/Article';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import WaveformPlayer from './WaveformPlayer';
import VideoPlayer from './VideoPlayer';
import { getMediaUrl } from '../utils/audio';
import { deleteSegment } from '../services/api';

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

  const getBackgroundColor = () => {
    if (segment.segment_type === 'human') return '#f5f9ff';
    if (segment.segment_type === 'source') return '#f5fff5';
    return '#fdf5f9';
  };

  const getSegmentIcon = () => {
    if (segment.segment_type === 'human') return <PersonIcon />;
    if (segment.segment_type === 'source') return <ArticleIcon />;
    return <SmartToyIcon />;
  };

  const getSegmentLabel = () => {
    if (segment.segment_type === 'human') return 'Human';
    if (segment.segment_type === 'source') return 'Source';
    return 'AI';
  };

  const getSegmentColor = () => {
    if (segment.segment_type === 'human') return 'primary';
    if (segment.segment_type === 'source') return 'success';
    return 'secondary';
  };

  return (
    <Card sx={{ 
      mb: 2, 
      opacity: isDragging ? 0.5 : 1,
      backgroundColor: getBackgroundColor()
    }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          {dragHandleProps ? (
            <Box {...dragHandleProps} sx={{ mr: 1, cursor: 'grab' }}>
              <DragIndicatorIcon color="action" />
            </Box>
          ) : null}
          
          <Chip 
            icon={getSegmentIcon()}
            label={getSegmentLabel()}
            color={getSegmentColor()}
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
          

          {segment.video_path && (
            <Box sx={{ mt: 2 }} onClick={handlePlayClick}>
              <VideoPlayer 
                videoUrl={getMediaUrl(segment.video_path)}
                onReady={() => {
                  console.log('Video ready');
                }}
                compact={true}
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