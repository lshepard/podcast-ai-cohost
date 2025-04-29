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
  Grid,
  CircularProgress,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import LanguageIcon from '@mui/icons-material/Language';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import TextFieldsIcon from '@mui/icons-material/TextFields';
import { getSources, addSourceToEpisode, removeSourceFromEpisode, createSource } from '../services/api';

const SourceType = {
  WEB: 'web',
  PDF: 'pdf',
  TEXT: 'text',
};

const SourceTypeDialog = ({ open, onClose, onSelect }) => {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Add New Source</DialogTitle>
      <DialogContent>
        <Grid container spacing={2} sx={{ mt: 1 }}>
          <Grid item xs={12} sm={4}>
            <Button
              fullWidth
              variant="outlined"
              startIcon={<LanguageIcon />}
              onClick={() => onSelect(SourceType.WEB)}
              sx={{ height: '100px' }}
            >
              Scrape Web Page
            </Button>
          </Grid>
          <Grid item xs={12} sm={4}>
            <Button
              fullWidth
              variant="outlined"
              startIcon={<PictureAsPdfIcon />}
              onClick={() => onSelect(SourceType.PDF)}
              sx={{ height: '100px' }}
            >
              Upload PDF
            </Button>
          </Grid>
          <Grid item xs={12} sm={4}>
            <Button
              fullWidth
              variant="outlined"
              startIcon={<TextFieldsIcon />}
              onClick={() => onSelect(SourceType.TEXT)}
              sx={{ height: '100px' }}
            >
              Enter Text
            </Button>
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
      </DialogActions>
    </Dialog>
  );
};

const SourceContentDialog = ({ 
  open, 
  onClose, 
  sourceType, 
  onSubmit 
}) => {
  const [url, setUrl] = useState('');
  const [file, setFile] = useState(null);
  const [text, setText] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async () => {
    setIsLoading(true);
    try {
      let content = '';
      let title = '';
      let sourceData = {};

      switch (sourceType) {
        case SourceType.WEB:
          sourceData = {
            title: url,
            source_type: SourceType.WEB,
            url,
            content: '',
          };
          break;
        case SourceType.PDF:
          sourceData = {
            title: file ? file.name : url,
            source_type: SourceType.PDF,
            url: url || null,
            file_path: file ? file.name : null,
            content: '',
          };
          break;
        case SourceType.TEXT:
          sourceData = {
            title: text.substring(0, 50) + '...',
            source_type: SourceType.TEXT,
            content: text,
          };
          break;
      }

      await onSubmit(sourceData);
      onClose();
    } catch (err) {
      console.error('Error creating source:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        {sourceType === SourceType.WEB && 'Scrape Web Page'}
        {sourceType === SourceType.PDF && 'Upload PDF'}
        {sourceType === SourceType.TEXT && 'Enter Text'}
      </DialogTitle>
      <DialogContent>
        <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {sourceType === SourceType.WEB && (
            <TextField
              fullWidth
              label="URL"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com"
            />
          )}
          {sourceType === SourceType.PDF && (
            <>
              <TextField
                fullWidth
                label="PDF URL (optional)"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com/document.pdf"
              />
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Button
                  variant="outlined"
                  component="label"
                  sx={{ flex: 1 }}
                >
                  Upload PDF
                  <input
                    type="file"
                    hidden
                    accept=".pdf"
                    onChange={(e) => setFile(e.target.files[0])}
                  />
                </Button>
                {file && (
                  <Typography variant="body2">
                    {file.name}
                  </Typography>
                )}
              </Box>
            </>
          )}
          {sourceType === SourceType.TEXT && (
            <TextField
              fullWidth
              multiline
              rows={4}
              label="Text Content"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={isLoading || 
            (sourceType === SourceType.WEB && !url) ||
            (sourceType === SourceType.PDF && !url && !file) ||
            (sourceType === SourceType.TEXT && !text)
          }
        >
          {isLoading ? <CircularProgress size={24} /> : 'Create'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

const EpisodeSources = ({ episodeId, episodeSources = [] }) => {
  const [sources, setSources] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [typeDialogOpen, setTypeDialogOpen] = useState(false);
  const [contentDialogOpen, setContentDialogOpen] = useState(false);
  const [selectedSourceType, setSelectedSourceType] = useState(null);
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
    setTypeDialogOpen(true);
  };

  const handleSourceTypeSelect = (type) => {
    setSelectedSourceType(type);
    setTypeDialogOpen(false);
    setContentDialogOpen(true);
  };

  const handleSourceCreate = async (sourceData) => {
    try {
      const response = await createSource(sourceData);
      const newSource = response.data;
      await addSourceToEpisode(episodeId, newSource.id);
      await fetchSources();
    } catch (err) {
      console.error('Error creating source:', err);
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
    return <Typography component="div">Loading sources...</Typography>;
  }

  if (error) {
    return <Typography component="div" color="error">{error}</Typography>;
  }

  return (
    <Box component="div">
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6" component="div">Episode Sources</Typography>
        <Button
          variant="outlined"
          startIcon={<AddIcon />}
          onClick={handleAddSource}
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
            <ListItemText primary="No sources added to this episode" />
          </ListItem>
        )}
      </List>

      <SourceTypeDialog
        open={typeDialogOpen}
        onClose={() => setTypeDialogOpen(false)}
        onSelect={handleSourceTypeSelect}
      />

      <SourceContentDialog
        open={contentDialogOpen}
        onClose={() => setContentDialogOpen(false)}
        sourceType={selectedSourceType}
        onSubmit={handleSourceCreate}
      />
    </Box>
  );
};

export default EpisodeSources; 