import React, { useState, useEffect } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  Snackbar,
  TextField,
  Typography,
  Alert,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import { getEpisodes, createEpisode, deleteEpisode } from '../services/api';

const EpisodeList = () => {
  const [episodes, setEpisodes] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [notification, setNotification] = useState({ open: false, message: '', severity: 'info' });
  const [newEpisode, setNewEpisode] = useState({ title: '', description: '' });

  useEffect(() => {
    fetchEpisodes();
  }, []);

  const fetchEpisodes = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await getEpisodes();
      setEpisodes(response.data);
    } catch (err) {
      setError('Failed to load episodes');
      console.error('Error fetching episodes:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddEpisode = () => {
    setNewEpisode({ title: '', description: '' });
    setDialogOpen(true);
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setNewEpisode({
      ...newEpisode,
      [name]: value
    });
  };

  const handleCreateEpisode = async () => {
    if (!newEpisode.title) return;
    
    try {
      const response = await createEpisode(newEpisode);
      setEpisodes([...episodes, response.data]);
      setDialogOpen(false);
      showNotification('Episode created successfully', 'success');
    } catch (err) {
      console.error('Error creating episode:', err);
      showNotification('Failed to create episode', 'error');
    }
  };

  const handleDeleteEpisode = async (episodeId) => {
    if (window.confirm('Are you sure you want to delete this episode?')) {
      try {
        await deleteEpisode(episodeId);
        setEpisodes(episodes.filter(episode => episode.id !== episodeId));
        showNotification('Episode deleted successfully', 'success');
      } catch (err) {
        console.error('Error deleting episode:', err);
        showNotification('Failed to delete episode', 'error');
      }
    }
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

  return (
    <Container maxWidth="lg">
      <Box sx={{ mt: 4, mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h4">Podcast Episodes</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleAddEpisode}
        >
          New Episode
        </Button>
      </Box>
      
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}
      
      {episodes.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <Typography variant="body1" color="text.secondary">
            No episodes found. Create your first episode to get started.
          </Typography>
        </Box>
      ) : (
        <Grid container spacing={3}>
          {episodes.map(episode => (
            <Grid item xs={12} md={6} key={episode.id}>
              <Card>
                <CardContent>
                  <Typography variant="h5" gutterBottom>
                    {episode.title}
                  </Typography>
                  
                  <Typography variant="body2" color="text.secondary" paragraph>
                    {episode.description || 'No description'}
                  </Typography>
                  
                  <Typography variant="caption" color="text.secondary" display="block">
                    Created: {new Date(episode.created_at).toLocaleDateString()}
                  </Typography>
                  
                  <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
                    <IconButton
                      color="error"
                      onClick={() => handleDeleteEpisode(episode.id)}
                      sx={{ mr: 1 }}
                    >
                      <DeleteIcon />
                    </IconButton>
                    
                    <Button
                      component={RouterLink}
                      to={`/episodes/${episode.id}`}
                      variant="contained"
                      color="primary"
                      startIcon={<EditIcon />}
                    >
                      Edit Episode
                    </Button>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}
      
      {/* Add Episode Dialog */}
      <Dialog open={dialogOpen} onClose={handleDialogClose} maxWidth="sm" fullWidth>
        <DialogTitle>Create New Episode</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            name="title"
            label="Episode Title"
            type="text"
            fullWidth
            variant="outlined"
            value={newEpisode.title}
            onChange={handleInputChange}
            sx={{ mb: 2 }}
          />
          <TextField
            margin="dense"
            name="description"
            label="Description"
            multiline
            rows={4}
            fullWidth
            variant="outlined"
            value={newEpisode.description}
            onChange={handleInputChange}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDialogClose}>Cancel</Button>
          <Button
            onClick={handleCreateEpisode}
            variant="contained"
            color="primary"
            disabled={!newEpisode.title}
          >
            Create
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

export default EpisodeList; 