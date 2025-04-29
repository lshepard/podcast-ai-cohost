import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  ButtonGroup,
  CircularProgress,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Paper,
  Snackbar,
  TextField,
  Typography,
  Alert,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import PersonIcon from '@mui/icons-material/Person';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import SegmentItem from './SegmentItem';
import AudioRecorder from './AudioRecorder';
import TextEditor from './TextEditor';
import { 
  getEpisode, 
  getSegments, 
  createSegment, 
  updateSegment, 
  uploadAudio, 
  generateText,
  generateSpeech
} from '../services/api';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';

const EpisodeEditor = ({ episodeId }) => {
  const [episode, setEpisode] = useState(null);
  const [segments, setSegments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Dialog states
  const [addHumanDialogOpen, setAddHumanDialogOpen] = useState(false);
  const [addBotDialogOpen, setAddBotDialogOpen] = useState(false);
  const [notification, setNotification] = useState({ open: false, message: '', severity: 'info' });

  // States for adding segments
  const [recordedAudioBlob, setRecordedAudioBlob] = useState(null);
  const [botPrompt, setBotPrompt] = useState('');
  const [botResponse, setBotResponse] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    fetchEpisodeData();
  }, [episodeId]);

  const fetchEpisodeData = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const episodeResponse = await getEpisode(episodeId);
      setEpisode(episodeResponse.data);
      
      const segmentsResponse = await getSegments(episodeId);
      setSegments(segmentsResponse.data);
    } catch (err) {
      setError('Failed to load episode data');
      console.error('Error fetching episode data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddHumanSegment = () => {
    setAddHumanDialogOpen(true);
  };

  const handleAddBotSegment = () => {
    setAddBotDialogOpen(true);
  };

  const handleHumanDialogClose = () => {
    setAddHumanDialogOpen(false);
    setRecordedAudioBlob(null);
  };

  const handleBotDialogClose = () => {
    setAddBotDialogOpen(false);
    setBotPrompt('');
    setBotResponse('');
    setIsGenerating(false);
  };

  const handleAudioRecorded = (blob) => {
    setRecordedAudioBlob(blob);
  };

  const handleAudioUploaded = async (blob, episodeId, segmentId) => {
    try {
      // First create a segment
      if (!segmentId) {
        const newSegmentData = {
          segment_type: 'human',
          order_index: segments.length,
          text_content: ''
        };
        
        const segmentResponse = await createSegment(episodeId, newSegmentData);
        segmentId = segmentResponse.data.id;
      }
      
      // Upload the audio file
      const formData = new FormData();
      formData.append('file', blob);
      
      await uploadAudio(episodeId, segmentId, blob);
      
      // Refresh segments
      await fetchEpisodeData();
      
      // Close dialog
      handleHumanDialogClose();
      
      showNotification('Human segment added successfully', 'success');
    } catch (err) {
      console.error('Error uploading audio:', err);
      showNotification('Failed to upload audio', 'error');
    }
  };

  const handleGenerateResponse = async (prompt) => {
    setIsGenerating(true);
    setBotResponse('');
    
    try {
      const response = await generateText(episodeId, prompt || botPrompt);
      
      if (response.data.success && response.data.text) {
        setBotResponse(response.data.text);
      } else {
        throw new Error(response.data.message || 'Failed to generate response');
      }
    } catch (err) {
      console.error('Error generating AI response:', err);
      showNotification('Failed to generate AI response', 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveBot = async () => {
    if (!botResponse) return;
    
    try {
      const newSegmentData = {
        segment_type: 'bot',
        order_index: segments.length,
        text_content: botResponse
      };
      
      const response = await createSegment(episodeId, newSegmentData);
      const newSegment = response.data;
      
      // Generate speech for the new bot segment
      try {
        const outputPath = `/episodes/${episodeId}/segments/${newSegment.id}.mp3`;
        await generateSpeech(botResponse, outputPath);
        
        // Update the segment with the audio path
        await updateSegment(episodeId, newSegment.id, {
          audio_path: outputPath
        });
      } catch (speechErr) {
        console.error('Error generating speech for new bot segment:', speechErr);
        // Continue with the flow even if speech generation fails
      }
      
      // Refresh segments
      await fetchEpisodeData();
      
      // Close dialog
      handleBotDialogClose();
      
      showNotification('AI segment added successfully', 'success');
    } catch (err) {
      console.error('Error saving bot segment:', err);
      showNotification('Failed to save AI segment', 'error');
    }
  };

  const handleSegmentUpdate = (updatedSegment) => {
    setSegments(segments.map(seg => 
      seg.id === updatedSegment.id ? updatedSegment : seg
    ));
  };

  const handleSegmentDelete = (segmentId) => {
    setSegments(segments.filter(seg => seg.id !== segmentId));
    showNotification('Segment deleted successfully', 'success');
  };

  const showNotification = (message, severity = 'info') => {
    setNotification({
      open: true,
      message,
      severity
    });
  };

  const handleCloseNotification = () => {
    setNotification({ ...notification, open: false });
  };

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ mt: 4 }}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  return (
    <Container maxWidth="md">
      <Paper sx={{ p: 3, mt: 3 }}>
        <Typography variant="h4" gutterBottom>
          {episode?.title || 'Episode Editor'}
        </Typography>
        
        {episode?.description && (
          <Typography variant="body1" color="text.secondary" paragraph>
            {episode.description}
          </Typography>
        )}
        
        <Divider sx={{ my: 2 }} />
        
        <Typography variant="h6" gutterBottom>
          Segments
        </Typography>
        
        {segments.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ my: 3 }}>
            No segments yet. Add your first segment below.
          </Typography>
        ) : (
          <Box sx={{ my: 2 }}>
            {segments.map(segment => (
              <SegmentItem
                key={segment.id}
                segment={segment}
                episodeId={episodeId}
                onDelete={handleSegmentDelete}
                onUpdate={handleSegmentUpdate}
                apiBaseUrl={API_URL}
              />
            ))}
          </Box>
        )}
        
        <Box sx={{ mt: 3, display: 'flex', justifyContent: 'center' }}>
          <ButtonGroup variant="contained">
            <Button
              startIcon={<PersonIcon />}
              onClick={handleAddHumanSegment}
            >
              Add Human Segment
            </Button>
            <Button
              startIcon={<SmartToyIcon />}
              onClick={handleAddBotSegment}
              color="secondary"
            >
              Add AI Segment
            </Button>
          </ButtonGroup>
        </Box>
      </Paper>
      
      {/* Human Dialog */}
      <Dialog
        open={addHumanDialogOpen}
        onClose={handleHumanDialogClose}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Add Human Segment</DialogTitle>
        <DialogContent>
          <AudioRecorder
            onAudioRecorded={handleAudioRecorded}
            onAudioUploaded={(blob) => handleAudioUploaded(blob, episodeId)}
            episodeId={episodeId}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleHumanDialogClose}>Cancel</Button>
        </DialogActions>
      </Dialog>
      
      {/* Bot Dialog */}
      <Dialog
        open={addBotDialogOpen}
        onClose={handleBotDialogClose}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Add AI Segment</DialogTitle>
        <DialogContent>
          <Box sx={{ my: 2 }}>
            <Typography variant="subtitle1" gutterBottom>
              Optional Prompt
            </Typography>
            <TextField
              fullWidth
              multiline
              rows={2}
              placeholder="Enter a prompt for the AI (leave empty for default generation)"
              value={botPrompt}
              onChange={(e) => setBotPrompt(e.target.value)}
              disabled={isGenerating}
            />
            <Button
              variant="contained"
              color="primary"
              sx={{ mt: 2 }}
              onClick={() => handleGenerateResponse()}
              disabled={isGenerating}
              startIcon={isGenerating ? <CircularProgress size={20} /> : <SmartToyIcon />}
            >
              {isGenerating ? 'Generating...' : 'Generate Response'}
            </Button>
          </Box>
          
          {botResponse && (
            <Box sx={{ mt: 3 }}>
              <TextEditor
                text={botResponse}
                title="AI Response"
                onSave={(text) => setBotResponse(text)}
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleBotDialogClose}>Cancel</Button>
          <Button 
            onClick={handleSaveBot} 
            variant="contained" 
            disabled={!botResponse}
            color="primary"
          >
            Save Segment
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Notification */}
      <Snackbar
        open={notification.open}
        autoHideDuration={6000}
        onClose={handleCloseNotification}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert 
          onClose={handleCloseNotification} 
          severity={notification.severity} 
          sx={{ width: '100%' }}
        >
          {notification.message}
        </Alert>
      </Snackbar>
    </Container>
  );
};

export default EpisodeEditor; 