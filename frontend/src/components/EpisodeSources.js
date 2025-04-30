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
  Autocomplete,
  TextField,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import { getSources, addSourceToEpisode, removeSourceFromEpisode } from '../services/api';

const EpisodeSources = ({ episodeId, episodeSources = [], onSourcesUpdate }) => {
  const [sources, setSources] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [attachDialogOpen, setAttachDialogOpen] = useState(false);
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

  const handleAttachSource = async () => {
    if (selectedSource) {
      try {
        await addSourceToEpisode(episodeId, selectedSource.id);
        setAttachDialogOpen(false);
        setSelectedSource(null);
        if (onSourcesUpdate) {
          onSourcesUpdate();
        }
      } catch (err) {
        console.error('Error attaching source to episode:', err);
      }
    }
  };

  const handleRemoveSource = async (sourceId) => {
    try {
      await removeSourceFromEpisode(episodeId, sourceId);
      if (onSourcesUpdate) {
        onSourcesUpdate();
      }
    } catch (err) {
      console.error('Error removing source from episode:', err);
    }
  };

  if (isLoading) {
    return <Typography component="div">Loading sources...</Typography>;
  }

  if (error) {
    return <Typography component="div" color="error">{error}</Typography>;
  }

  // Filter out sources that are already attached to this episode
  const availableSources = sources.filter(
    source => !episodeSources.some(episodeSource => episodeSource.id === source.id)
  );

  return (
    <Box component="div">
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6" component="div">Episode Sources</Typography>
        <Button
          variant="outlined"
          startIcon={<AddIcon />}
          onClick={() => setAttachDialogOpen(true)}
        >
          Attach Source
        </Button>
      </Box>

      <List>
        {episodeSources.map((source) => (
          <ListItem key={source.id}>
            <ListItemText
              primary={source.title}
              secondary={
                <Box component="span" sx={{ display: 'flex', flexDirection: 'column', gap: 1, mt: 1 }}>
                  <Box component="span" sx={{ display: 'flex', gap: 1 }}>
                    <Chip
                      label={source.source_type}
                      size="small"
                      color={source.source_type === 'pdf' ? 'primary' : 'secondary'}
                    />
                    <Typography variant="body2" color="text.secondary" component="span">
                      {source.url || source.file_path}
                    </Typography>
                  </Box>
                  {source.summary && (
                    <Typography variant="body2" color="text.secondary" component="span">
                      {source.summary}
                    </Typography>
                  )}
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
            <ListItemText primary="No sources attached to this episode" />
          </ListItem>
        )}
      </List>

      <Dialog open={attachDialogOpen} onClose={() => setAttachDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Attach Source to Episode</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <Autocomplete
              options={availableSources}
              getOptionLabel={(option) => option.title}
              value={selectedSource}
              onChange={(event, newValue) => setSelectedSource(newValue)}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Select Source"
                  fullWidth
                />
              )}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAttachDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleAttachSource}
            variant="contained"
            disabled={!selectedSource}
          >
            Attach
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default EpisodeSources; 