import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box,
  Button,
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
  IconButton,
  Menu,
  MenuItem,
  Switch,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import PersonIcon from '@mui/icons-material/Person';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import EditIcon from '@mui/icons-material/Edit';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import SegmentItem from './SegmentItem';
import SortableSegmentItem from './SortableSegmentItem';
import AudioRecorder from './AudioRecorder';
import TextEditor from './TextEditor';
import EditDialog from './EditDialog';
import { 
  getEpisode, 
  getSegments, 
  createSegment, 
  updateSegment, 
  uploadAudio, 
  generateText,
  generateSpeech
} from '../services/api';
import EpisodeSources from './EpisodeSources';
import NotesEditor from './NotesEditor';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';

const EpisodeEditor = ({ episodeId, onSave }) => {
  const [episode, setEpisode] = useState(null);
  const [segments, setSegments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeId, setActiveId] = useState(null);
  
  // Dialog states
  const [addHumanDialogOpen, setAddHumanDialogOpen] = useState(false);
  const [addBotDialogOpen, setAddBotDialogOpen] = useState(false);
  const [notification, setNotification] = useState({ open: false, message: '', severity: 'info' });
  
  // Edit Dialog
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [currentEditSegment, setCurrentEditSegment] = useState(null);
  
  // Insert segment menu
  const [menuAnchorEl, setMenuAnchorEl] = useState(null);
  const [insertPosition, setInsertPosition] = useState(null);
  
  // States for adding segments
  const [recordedAudioBlob, setRecordedAudioBlob] = useState(null);
  const [botPrompt, setBotPrompt] = useState('');
  const [botResponse, setBotResponse] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Play All feature
  const [playAllEnabled, setPlayAllEnabled] = useState(false);
  const [currentPlayingIndex, setCurrentPlayingIndex] = useState(null);
  
  // Set up DnD sensors with better movement thresholds
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
        delay: 100,
        tolerance: 5
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Create a stable reference to segments for event handlers
  const segmentsRef = useRef(segments);
  
  // Update the ref whenever segments change
  useEffect(() => {
    segmentsRef.current = segments;
  }, [segments]);

  // Memoize the edit segment handler
  const handleEditSegment = useCallback((event) => {
    const segmentId = event.detail.segmentId;
    const segment = segmentsRef.current.find(s => s.id === segmentId);
    if (segment) {
      setCurrentEditSegment(segment);
      setEditDialogOpen(true);
    }
  }, []);
  
  // Set up event listeners separately from data fetching
  useEffect(() => {
    // Add event listener for edit segment events
    document.addEventListener('editSegment', handleEditSegment);
    
    return () => {
      document.removeEventListener('editSegment', handleEditSegment);
    };
  }, [handleEditSegment]);

  const fetchEpisode = useCallback(async () => {
    try {
      const response = await getEpisode(episodeId);
      setEpisode(response.data);
    } catch (err) {
      console.error('Error fetching episode:', err);
    }
  }, [episodeId]);

  const fetchEpisodeData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const segmentsResponse = await getSegments(episodeId);
      const segmentsWithIds = segmentsResponse.data.map(segment => ({
        ...segment,
        id: segment.id.toString()
      }));
      setSegments(segmentsWithIds);
      
      // Log segment IDs for debugging
      console.log('Segment IDs:', segmentsWithIds.map(s => s.id));
    } catch (err) {
      setError('Failed to load episode data');
      console.error('Error fetching episode data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [episodeId]);

  useEffect(() => {
    fetchEpisode();
    fetchEpisodeData();
  }, [episodeId, fetchEpisode, fetchEpisodeData]);

  const handleAddHumanSegment = (position = null) => {
    setInsertPosition(position);
    setAddHumanDialogOpen(true);
  };

  const handleAddBotSegment = (position = null) => {
    setInsertPosition(position);
    setAddBotDialogOpen(true);
  };

  const handleHumanDialogClose = () => {
    setAddHumanDialogOpen(false);
    setInsertPosition(null);
  };

  const handleBotDialogClose = () => {
    setAddBotDialogOpen(false);
    setBotPrompt('');
    setBotResponse('');
    setIsGenerating(false);
    setInsertPosition(null);
    setSkippedGeneration(false);
  };

  const handleAudioRecorded = (blob) => {
    setRecordedAudioBlob(blob);
  };

  const handleAudioUploaded = async (blob, episodeId, segmentId) => {
    try {
      // First create a segment
      if (!segmentId) {
        // If we're inserting at a specific position, handle reordering
        let segmentIndex = segments.length;
        if (insertPosition !== null && insertPosition >= 0) {
          segmentIndex = insertPosition;
        }
        
        const newSegmentData = {
          segment_type: 'human',
          order_index: segmentIndex,
          text_content: ''
        };
        
        const segmentResponse = await createSegment(episodeId, newSegmentData);
        segmentId = segmentResponse.data.id;
        
        // If inserting in the middle, update order_index of subsequent segments
        if (insertPosition !== null && insertPosition < segments.length) {
          await updateSegmentOrders(segments, insertPosition, true);
        }
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
      // If we're inserting at a specific position, handle reordering
      let segmentIndex = segments.length;
      if (insertPosition !== null && insertPosition >= 0) {
        segmentIndex = insertPosition;
      }
      
      // Create and save the segment immediately
      const newSegmentData = {
        segment_type: 'bot',
        order_index: segmentIndex,
        text_content: botResponse
      };
      
      const response = await createSegment(episodeId, newSegmentData);
      const newSegment = response.data;
      
      // If inserting in the middle, update order_index of subsequent segments
      if (insertPosition !== null && insertPosition < segments.length) {
        await updateSegmentOrders(segments, insertPosition, true);
      }
      
      // Close the dialog immediately
      handleBotDialogClose();
      
      // Show initial success message
      showNotification('AI segment saved successfully', 'success');
      
      // Add the new segment to the list without waiting for audio
      setSegments(prevSegments => {
        const newSegments = [...prevSegments];
        // Add id property for dnd-kit
        const newSegmentWithId = { 
          ...newSegment, 
          id: newSegment.id.toString()
        };
        
        if (insertPosition !== null && insertPosition >= 0) {
          newSegments.splice(insertPosition, 0, newSegmentWithId);
        } else {
          newSegments.push(newSegmentWithId);
        }
        return newSegments;
      });
      
      // Generate speech asynchronously
      generateAudioForSegment(newSegment.id, botResponse);
    } catch (err) {
      console.error('Error saving bot segment:', err);
      showNotification('Failed to save AI segment', 'error');
    }
  };

  // Separate function to generate audio for a segment
  const generateAudioForSegment = async (segmentId, text) => {
    try {
      // First update the segment to show generating status
      setSegments(prevSegments => 
        prevSegments.map(seg => 
          seg.id === segmentId.toString()
            ? { ...seg, isGeneratingSpeech: true } 
            : seg
        )
      );
      
      // Generate the speech with the updated API
      const response = await generateSpeech(text, episodeId, segmentId);
      
      if (response.data.success) {
        // No need to update the segment with audio_path, it's already done by the backend
        // Just refresh to get the latest data
        await fetchEpisodeData();
      } else {
        // Show the specific error message from the backend
        const errorMessage = response.data.message || 'Failed to generate speech';
        console.error('Audio generation error:', errorMessage);
        showNotification(`Audio generation failed: ${errorMessage}`, 'error');
        throw new Error(errorMessage);
      }
    } catch (err) {
      console.error('Error generating speech:', err);
      const errorMessage = err.response?.data?.message || err.message || 'Unknown error';
      showNotification(`Audio generation failed: ${errorMessage}`, 'error');
      
      // Update segments to remove loading state
      setSegments(prevSegments => 
        prevSegments.map(seg => 
          seg.id === segmentId.toString()
            ? { ...seg, isGeneratingSpeech: false } 
            : seg
        )
      );
    }
  };

  // Memoize segment handlers to prevent unnecessary re-renders
  const handleSegmentUpdate = useCallback((updatedSegment) => {
    setSegments(prevSegments => prevSegments.map(seg => 
      seg.id === updatedSegment.id.toString()
        ? { ...updatedSegment, id: updatedSegment.id.toString() } 
        : seg
    ));
  }, []);

  const handleSegmentDelete = useCallback((segmentId) => {
    setSegments(prevSegments => prevSegments.filter(seg => seg.id !== segmentId.toString()));
    showNotification('Segment deleted successfully', 'success');
  }, []);

  // Stabilize the DnD context with memoized callbacks
  const handleDragStart = useCallback((event) => {
    setActiveId(event.active.id);
  }, []);

  // Handle drag end with dnd-kit
  const handleDragEnd = async (event) => {
    const { active, over } = event;
    
    if (!over || active.id === over.id) {
      setActiveId(null);
      return;
    }
    
    try {
      // Find indices for source and destination
      const oldIndex = segments.findIndex(segment => segment.id === active.id);
      const newIndex = segments.findIndex(segment => segment.id === over.id);
      
      if (oldIndex === newIndex) {
        setActiveId(null);
        return;
      }
      
      // Create reordered array
      const reorderedSegments = arrayMove(segments, oldIndex, newIndex);
      
      // Update UI immediately
      setSegments(reorderedSegments);
      
      // Update order indexes in database
      const reorderedIds = reorderedSegments.map((segment, index) => ({
        id: parseInt(segment.id),
        order_index: index
      }));
      
      await Promise.all(
        reorderedIds.map(segment => 
          updateSegment(episodeId, segment.id, {
            order_index: segment.order_index
          })
        )
      );
      
      showNotification('Segments reordered successfully', 'success');
    } catch (err) {
      console.error('Error reordering segments:', err);
      showNotification('Failed to reorder segments', 'error');
      
      // Revert to original order on error
      await fetchEpisodeData();
    } finally {
      setActiveId(null);
    }
  };
  
  // Update segment order indexes in the database
  const updateSegmentOrders = async (segmentsToUpdate, startIndex = 0, isInsert = false) => {
    // If inserting, only update segments after the insertion point
    const segmentsToReorder = isInsert
      ? segments.slice(startIndex).map((seg, i) => ({ 
          id: parseInt(seg.id), // Convert string ID back to number
          order_index: startIndex + i + 1 
        }))
      : segmentsToUpdate.map((seg, i) => ({ 
          id: parseInt(seg.id), // Convert string ID back to number
          order_index: i 
        }));
    
    // Update each segment's order_index in the database
    if (segmentsToReorder.length > 0) {
      await Promise.all(
        segmentsToReorder.map(segment => 
          updateSegment(episodeId, segment.id, {
            order_index: segment.order_index
          })
        )
      );
    }
  };
  
  // Open the insert menu
  const handleOpenInsertMenu = (event, position) => {
    setMenuAnchorEl(event.currentTarget);
    setInsertPosition(position);
  };
  
  // Close the insert menu
  const handleCloseInsertMenu = () => {
    setMenuAnchorEl(null);
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

  // Get the active segment for drag overlay
  const getActiveSegment = () => {
    if (!activeId) return null;
    return segments.find(segment => segment.id === activeId);
  };

  // Handle saving edited segment text
  const handleSaveEditedSegment = async (newText) => {
    if (!currentEditSegment) return;
    
    try {
      const segmentId = currentEditSegment.id;
      
      // Update UI immediately for better UX
      setSegments(prevSegments => prevSegments.map(seg => 
        seg.id === segmentId ? { ...seg, text_content: newText } : seg
      ));
      
      // Close dialog immediately
      setEditDialogOpen(false);
      
      // Update text content in database
      await updateSegment(episodeId, segmentId, {
        text_content: newText
      });
      
      // For bot segments, regenerate audio
      if (currentEditSegment.segment_type === 'bot') {
        // Mark as generating in UI
        setSegments(prevSegments => prevSegments.map(seg => 
          seg.id === segmentId ? { ...seg, isGeneratingSpeech: true } : seg
        ));
        
        // Generate audio in background
        generateAudioForSegment(segmentId, newText);
      }
      
      showNotification('Segment updated successfully', 'success');
    } catch (err) {
      console.error('Error updating segment:', err);
      showNotification('Failed to update segment', 'error');
    }
  };

  const handleSaveNotes = async (notes) => {
    try {
      const response = await fetch(`${API_URL}/episodes/${episodeId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ notes }),
      });

      if (!response.ok) {
        throw new Error('Failed to save notes');
      }

      const updatedEpisode = await response.json();
      onSave(updatedEpisode);
    } catch (error) {
      console.error('Error saving notes:', error);
      // Handle error (e.g., show notification)
    }
  };

  const [detailsExpanded, setDetailsExpanded] = useState(true);
  const [editedTitle, setEditedTitle] = useState('');
  const [editedDescription, setEditedDescription] = useState('');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [isEditingNotes, setIsEditingNotes] = useState(false);

  useEffect(() => {
    if (episode) {
      setEditedTitle(episode.title || '');
      setEditedDescription(episode.description || '');
    }
  }, [episode]);

  const handleSaveTitle = async () => {
    try {
      const response = await fetch(`${API_URL}/episodes/${episodeId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ title: editedTitle }),
      });

      if (!response.ok) {
        throw new Error('Failed to save title');
      }

      const updatedEpisode = await response.json();
      onSave(updatedEpisode);
      setIsEditingTitle(false);
    } catch (error) {
      console.error('Error saving title:', error);
      showNotification('Failed to save title', 'error');
    }
  };

  const handleSaveDescription = async () => {
    try {
      const response = await fetch(`${API_URL}/episodes/${episodeId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ description: editedDescription }),
      });

      if (!response.ok) {
        throw new Error('Failed to save description');
      }

      const updatedEpisode = await response.json();
      onSave(updatedEpisode);
      setIsEditingDescription(false);
    } catch (error) {
      console.error('Error saving description:', error);
      showNotification('Failed to save description', 'error');
    }
  };

  // Handle toggling playAllEnabled
  const handlePlayAllToggle = (e) => {
    const newValue = e.target.checked;
    setPlayAllEnabled(newValue);
    
    // Reset current playing index when turned off
    if (!newValue) {
      setCurrentPlayingIndex(null);
    }
  };

  // Function to handle playing the next segment
  const handlePlayNext = useCallback(() => {
    if (!playAllEnabled || currentPlayingIndex === null) return;
    
    const nextIndex = currentPlayingIndex + 1;
    if (nextIndex < segments.length) {
      setCurrentPlayingIndex(nextIndex);
      
      // Scroll to the next segment
      setTimeout(() => {
        const segmentElement = document.getElementById(`segment-${segments[nextIndex].id}`);
        if (segmentElement) {
          segmentElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100); // Small delay to ensure DOM updates
    } else {
      // We've reached the end of the segments
      setCurrentPlayingIndex(null);
    }
  }, [playAllEnabled, currentPlayingIndex, segments]);

  // Function to start playing from a specific segment
  const handleStartPlayingFrom = useCallback((index) => {
    // Only set the index if play all is enabled
    if (playAllEnabled) {
      setCurrentPlayingIndex(index);
    }
  }, [playAllEnabled]);

  // Add at the top, after other useState hooks
  const [skippedGeneration, setSkippedGeneration] = useState(false);

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
    <Box>
      <Container maxWidth="md">
        <Paper sx={{ p: 3, mb: 3 }}>
          {isEditingTitle ? (
            <Box sx={{ mb: 2 }}>
              <TextField
                fullWidth
                value={editedTitle}
                onChange={(e) => setEditedTitle(e.target.value)}
                variant="outlined"
                size="large"
                sx={{
                  '& .MuiInputBase-input': {
                    fontSize: '2.125rem',
                    fontWeight: 500,
                  },
                }}
              />
              <Box sx={{ mt: 1, display: 'flex', justifyContent: 'flex-end' }}>
                <Button
                  variant="outlined"
                  onClick={() => {
                    setEditedTitle(episode?.title || '');
                    setIsEditingTitle(false);
                  }}
                  sx={{ mr: 1 }}
                >
                  Cancel
                </Button>
                <Button
                  variant="contained"
                  onClick={handleSaveTitle}
                >
                  Save Title
                </Button>
              </Box>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h4" gutterBottom>
                {episode?.title || 'Episode Editor'}
              </Typography>
              <IconButton
                onClick={() => setIsEditingTitle(true)}
                size="small"
                sx={{ ml: 1 }}
              >
                <EditIcon />
              </IconButton>
            </Box>
          )}
          
          <Box sx={{ mb: 2 }}>
            <Button
              onClick={() => setDetailsExpanded(!detailsExpanded)}
              endIcon={detailsExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              sx={{ mb: 1 }}
            >
              {detailsExpanded ? 'Hide Details' : 'Show Details'}
            </Button>
            
            {detailsExpanded && (
              <Box sx={{ pl: 2 }}>
                <Paper sx={{ p: 3, mb: 3 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography variant="h6">
                      Description
                    </Typography>
                    <IconButton
                      onClick={() => setIsEditingDescription(true)}
                      size="small"
                    >
                      <EditIcon />
                    </IconButton>
                  </Box>
                  {isEditingDescription ? (
                    <Box>
                      <TextField
                        fullWidth
                        multiline
                        rows={3}
                        value={editedDescription}
                        onChange={(e) => setEditedDescription(e.target.value)}
                        variant="outlined"
                      />
                      <Box sx={{ mt: 1, display: 'flex', justifyContent: 'flex-end' }}>
                        <Button
                          variant="outlined"
                          onClick={() => {
                            setEditedDescription(episode?.description || '');
                            setIsEditingDescription(false);
                          }}
                          sx={{ mr: 1 }}
                        >
                          Cancel
                        </Button>
                        <Button
                          variant="contained"
                          onClick={handleSaveDescription}
                        >
                          Save Description
                        </Button>
                      </Box>
                    </Box>
                  ) : (
                    <Typography variant="body1" color="text.secondary" paragraph>
                      {episode?.description || 'No description available'}
                    </Typography>
                  )}
                </Paper>

                <Paper sx={{ p: 3, mb: 3 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography variant="h6">
                      Notes and Script
                    </Typography>
                    <IconButton
                      onClick={() => setIsEditingNotes(true)}
                      size="small"
                    >
                      <EditIcon />
                    </IconButton>
                  </Box>
                  <NotesEditor
                    notes={episode?.notes}
                    onSave={handleSaveNotes}
                    isEditing={isEditingNotes}
                    onEditChange={setIsEditingNotes}
                  />
                </Paper>

                <Paper sx={{ p: 3 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography variant="h6">
                      Sources
                    </Typography>
                  </Box>
                  <EpisodeSources 
                    episodeId={episodeId} 
                    episodeSources={episode?.sources || []} 
                    onSourcesUpdate={fetchEpisode}
                  />
                </Paper>
              </Box>
            )}
          </Box>
        </Paper>

        <Paper sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h5">
              Segments
            </Typography>
            
            <Box sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              border: '1px solid #e0e0e0',
              borderRadius: 1,
              padding: '4px 12px',
              bgcolor: playAllEnabled ? 'rgba(33, 150, 243, 0.08)' : 'transparent'
            }}>
              <Typography variant="body2" sx={{ mr: 1, fontWeight: playAllEnabled ? 'bold' : 'normal' }}>
                Auto-Play All Segments
              </Typography>
              <Switch
                checked={playAllEnabled}
                onChange={handlePlayAllToggle}
                color="primary"
                size="small"
              />
            </Box>
          </Box>
          
          <Divider sx={{ my: 2 }} />
          
          <Box>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <Box sx={{ my: 2 }}>
                {/* Add insert button at the top */}
                <Box 
                  sx={{ 
                    display: 'flex', 
                    justifyContent: 'center', 
                    mb: 1, 
                    borderRadius: 1,
                    border: '1px dashed #ccc',
                    p: 0.5
                  }}
                >
                  <IconButton 
                    size="small" 
                    onClick={(e) => handleOpenInsertMenu(e, 0)}
                    color="primary"
                  >
                    <AddIcon />
                  </IconButton>
                </Box>
                
                {segments.length === 0 ? (
                  <Typography variant="body2" color="text.secondary" sx={{ my: 3, textAlign: 'center' }}>
                    No segments yet. Click the plus button above to add your first segment.
                  </Typography>
                ) : (
                  <SortableContext 
                    items={segments.map(s => s.id)} 
                    strategy={verticalListSortingStrategy}
                  >
                    {segments.map((segment, index) => (
                      <Box 
                        key={segment.id} 
                        sx={{ position: 'relative' }}
                        id={`segment-${segment.id}`}
                      >
                        <SortableSegmentItem
                          id={segment.id}
                          segment={segment}
                          episodeId={episodeId}
                          onDelete={handleSegmentDelete}
                          onUpdate={handleSegmentUpdate}
                          apiBaseUrl={API_URL}
                          playNext={handlePlayNext}
                          playAllEnabled={playAllEnabled && currentPlayingIndex === index}
                          onPlay={() => handleStartPlayingFrom(index)}
                        />
                        
                        {/* Add insert button between segments */}
                        <Box 
                          sx={{ 
                            display: 'flex', 
                            justifyContent: 'center', 
                            my: 0.5,
                            borderRadius: 1,
                            border: '1px dashed #eee',
                            p: 0.2
                          }}
                        >
                          <IconButton 
                            size="small" 
                            onClick={(e) => handleOpenInsertMenu(e, index + 1)}
                            color="primary"
                            sx={{ padding: '2px' }}
                          >
                            <AddIcon fontSize="small" />
                          </IconButton>
                        </Box>
                      </Box>
                    ))}
                  </SortableContext>
                )}
                
                <DragOverlay>
                  {activeId ? (
                    <SegmentItem
                      segment={getActiveSegment()}
                      episodeId={episodeId}
                      apiBaseUrl={API_URL}
                      isDragging={true}
                    />
                  ) : null}
                </DragOverlay>
              </Box>
            </DndContext>
          </Box>
        </Paper>
        
        {/* Insert Menu */}
        <Menu
          anchorEl={menuAnchorEl}
          open={Boolean(menuAnchorEl)}
          onClose={handleCloseInsertMenu}
        >
          <MenuItem 
            onClick={() => {
              handleCloseInsertMenu();
              handleAddHumanSegment(insertPosition);
            }}
          >
            <PersonIcon fontSize="small" sx={{ mr: 1 }} />
            Insert Human Segment
          </MenuItem>
          <MenuItem 
            onClick={() => {
              handleCloseInsertMenu();
              handleAddBotSegment(insertPosition);
            }}
          >
            <SmartToyIcon fontSize="small" sx={{ mr: 1 }} />
            Insert AI Segment
          </MenuItem>
        </Menu>
        
        {/* Human Dialog */}
        <Dialog
          open={addHumanDialogOpen}
          onClose={handleHumanDialogClose}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>
            {insertPosition !== null ? 'Insert Human Segment' : 'Add Human Segment'}
          </DialogTitle>
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
          <DialogTitle>
            {insertPosition !== null ? 'Insert AI Segment' : 'Add AI Segment'}
          </DialogTitle>
          <DialogContent>
            <Box sx={{ my: 2 }}>
              {!skippedGeneration && (
                <>
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
                  <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
                    <Button
                      variant="contained"
                      color="primary"
                      onClick={() => handleGenerateResponse()}
                      disabled={isGenerating}
                      startIcon={isGenerating ? <CircularProgress size={20} /> : <SmartToyIcon />}
                    >
                      {isGenerating ? 'Generating...' : 'Generate Response'}
                    </Button>
                    <Button
                      variant="outlined"
                      color="secondary"
                      onClick={() => {
                        setSkippedGeneration(true);
                        setBotResponse('');
                      }}
                      disabled={isGenerating}
                    >
                      Skip Generation
                    </Button>
                  </Box>
                </>
              )}
              {(botResponse || skippedGeneration) && (
                <Box sx={{ mt: 3 }}>
                  <TextEditor
                    text={botResponse}
                    title="AI Response"
                    onSave={(text) => setBotResponse(text)}
                  />
                </Box>
              )}
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => { handleBotDialogClose(); setSkippedGeneration(false); }}>Cancel</Button>
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
        
        {/* Edit Dialog */}
        <EditDialog
          open={editDialogOpen}
          segment={currentEditSegment}
          onClose={() => setEditDialogOpen(false)}
          onSave={handleSaveEditedSegment}
          isGenerating={false}
        />
        
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
    </Box>
  );
};

export default EpisodeEditor; 