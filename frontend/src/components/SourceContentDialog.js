import React, { useState } from 'react';
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
} from '@mui/material';

const SourceType = {
  WEB: 'web',
  PDF: 'pdf',
  TEXT: 'text',
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

export default SourceContentDialog; 