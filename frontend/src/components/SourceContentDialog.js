import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  CircularProgress,
  Typography,
  Link,
} from '@mui/material';
import VisibilityIcon from '@mui/icons-material/Visibility';
import EditIcon from '@mui/icons-material/Edit';

const SourceType = {
  WEB: 'web',
  PDF: 'pdf',
  TEXT: 'text',
};

// New component to display source content and summary
export const SourceContentDisplayDialog = ({ open, onClose, source, onSave, isEditing: initialIsEditing = false }) => {
  const [isEditing, setIsEditing] = useState(initialIsEditing);
  const [editedTitle, setEditedTitle] = useState('');
  const [editedSummary, setEditedSummary] = useState('');
  const [editedContent, setEditedContent] = useState('');

  useEffect(() => {
    if (source) {
      setEditedTitle(source.title || '');
      setEditedSummary(source.summary || '');
      setEditedContent(source.content || '');
    }
  }, [source]);

  useEffect(() => {
    setIsEditing(initialIsEditing);
  }, [initialIsEditing]);

  if (!source) return null;

  const handleSave = () => {
    onSave({
      ...source,
      title: editedTitle,
      summary: editedSummary,
      content: editedContent
    });
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditedTitle(source.title || '');
    setEditedSummary(source.summary || '');
    setEditedContent(source.content || '');
    setIsEditing(false);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        {isEditing ? (
          <TextField
            fullWidth
            value={editedTitle}
            onChange={(e) => setEditedTitle(e.target.value)}
            variant="standard"
            sx={{ mb: 1 }}
          />
        ) : (
          source.title
        )}
        {source.url && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            <Link href={source.url} target="_blank" rel="noopener noreferrer">
              {new URL(source.url).hostname}
            </Link>
          </Typography>
        )}
      </DialogTitle>
      <DialogContent>
        <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 3 }}>
          <Box>
            <Typography variant="subtitle1" gutterBottom>
              Summary
            </Typography>
            {isEditing ? (
              <TextField
                fullWidth
                multiline
                rows={4}
                value={editedSummary}
                onChange={(e) => setEditedSummary(e.target.value)}
                variant="outlined"
              />
            ) : (
              <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
                {source.summary || 'No summary available'}
              </Typography>
            )}
          </Box>
          <Box>
            <Typography variant="subtitle1" gutterBottom>
              Content
            </Typography>
            {isEditing ? (
              <TextField
                fullWidth
                multiline
                rows={8}
                value={editedContent}
                onChange={(e) => setEditedContent(e.target.value)}
                variant="outlined"
              />
            ) : (
              <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
                {source.content || 'No content available'}
              </Typography>
            )}
          </Box>
        </Box>
      </DialogContent>
      <DialogActions>
        {isEditing ? (
          <>
            <Button onClick={handleCancel}>Cancel</Button>
            <Button onClick={handleSave} variant="contained" color="primary">
              Save
            </Button>
          </>
        ) : (
          <Button onClick={onClose}>Close</Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

// Original component for creating/editing sources
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
      let sourceData = {};

      switch (sourceType) {
        case SourceType.WEB:
          sourceData = {
            source_type: SourceType.WEB,
            url,
          };
          break;
        case SourceType.PDF:
          sourceData = {
            source_type: SourceType.PDF,
            url: url || null,
            file_path: file ? file.name : null,
          };
          break;
        case SourceType.TEXT:
          sourceData = {
            source_type: SourceType.TEXT,
            content: text,
          };
          break;
      }

      console.log('Creating source with data:', sourceData);
      await onSubmit(sourceData);
      console.log('Source created successfully');
      onClose();
    } catch (err) {
      console.error('Error creating source:', err);
      if (err.response) {
        console.error('Error response:', err.response.data);
        console.error('Error status:', err.response.status);
        console.error('Error headers:', err.response.headers);
      }
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

export default SourceContentDialog; 