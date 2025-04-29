import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Typography,
  Chip,
  TextField,
  Autocomplete,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import { getSources, addSourceToEpisode, removeSourceFromEpisode } from '../services/api';

const EpisodeSources = ({ episodeId, episodeSources = [] }) => {
  const [sources, setSources] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedSource, setSelectedSource] = useState(null);

  useEffect(() => {
    fetchSources();
  }, []);

  const fetchSources = async () => {
    setIsLoading(true);
    try {
      const response = await getSources();
      setSources(response.data);
    } catch (err) {
      setError('Failed to load sources');
      console.error('Error fetching sources:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddSource = async () => {
    if (!selectedSource) return;
    
    try {
      await addSourceToEpisode(episodeId, selectedSource.id);
      setDialogOpen(false);
      setSelectedSource(null);
    } catch (err) {
      console.error('Error adding source to episode:', err);
    }
  };

  const handleRemoveSource = async (sourceId) => {
    try {
      await removeSourceFromEpisode(episodeId, sourceId);
    } catch (err) {
      console.error('Error removing source from episode:', err);
    }
  };

  if (isLoading) {
    return <Typography>Loading sources...</Typography>;
  }

  if (error) {
    return <Typography color="error">{error}</Typography>;
  }

  // Filter out sources that are already added to the episode
  const availableSources = sources.filter(
    source => !episodeSources.some(epSource => epSource.id === source.id)
  );

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">Episode Sources</Typography>
        <Button
          variant="outlined"
          startIcon={<AddIcon />}
          onClick={() => setDialogOpen(true)}
        >
          Add Source
        </Button>
      </Box>

      <List>
        {episodeSources.map((source) => (
          <ListItem key={source.id}>
            <ListItemText
              primary={source.title}
              secondary={
                <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                  <Chip
                    label={source.source_type}
                    size="small"
                    color={source.source_type === 'pdf' ? 'primary' : 'secondary'}
                  />
                  <Typography variant="body2" color="text.secondary">
                    {source.url || source.file_path}
                  </Typography>
                </Box>
              }
            />
            <ListItemSecondaryAction>
              <IconButton
                edge="end"
                aria-label="delete"
                onClick={() => handleRemoveSource(source.id)}
              >
                <DeleteIcon />
              </IconButton>
            </ListItemSecondaryAction>
          </ListItem>
        ))}
        {episodeSources.length === 0 && (
          <ListItem>
            <ListItemText primary="No sources added to this episode" />
          </ListItem>
        )}
      </List>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add Source to Episode</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <Autocomplete
              options={availableSources}
              getOptionLabel={(option) => option.title}
              value={selectedSource}
              onChange={(_, newValue) => setSelectedSource(newValue)}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Select Source"
                  fullWidth
                />
              )}
              renderOption={(props, option) => (
                <li {...props}>
                  <Box>
                    <Typography>{option.title}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {option.source_type} - {option.url || option.file_path}
                    </Typography>
                  </Box>
                </li>
              )}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleAddSource}
            variant="contained"
            disabled={!selectedSource}
          >
            Add
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default EpisodeSources; 