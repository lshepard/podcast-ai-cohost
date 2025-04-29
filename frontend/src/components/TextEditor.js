import React, { useState } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  Paper,
  TextField,
  Typography,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import SaveIcon from '@mui/icons-material/Save';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';

const TextEditor = ({ 
  text, 
  isGenerating, 
  onSave, 
  onGenerateRequest, 
  readOnly = false,
  title = 'Text'
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedText, setEditedText] = useState(text || '');
  const [prompt, setPrompt] = useState('');

  // When text prop changes, update local state
  React.useEffect(() => {
    setEditedText(text || '');
  }, [text]);

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleSave = () => {
    if (onSave) {
      onSave(editedText);
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditedText(text || '');
    setIsEditing(false);
  };

  const handleGenerateRequest = () => {
    if (onGenerateRequest) {
      onGenerateRequest(prompt);
    }
    setPrompt('');
  };

  return (
    <Paper sx={{ p: 2, mt: 2, position: 'relative' }}>
      <Typography variant="h6" gutterBottom>
        {title}
      </Typography>
      
      {isEditing ? (
        <>
          <TextField
            fullWidth
            multiline
            rows={6}
            value={editedText}
            onChange={(e) => setEditedText(e.target.value)}
            variant="outlined"
            sx={{ mb: 2 }}
          />
          <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button 
              sx={{ mr: 1 }} 
              variant="outlined" 
              onClick={handleCancel}
            >
              Cancel
            </Button>
            <Button 
              variant="contained" 
              color="primary" 
              startIcon={<SaveIcon />} 
              onClick={handleSave}
            >
              Save
            </Button>
          </Box>
        </>
      ) : (
        <>
          <Typography 
            variant="body1" 
            sx={{ 
              whiteSpace: 'pre-wrap',
              minHeight: '100px',
              backgroundColor: '#f5f5f5',
              p: 2,
              borderRadius: 1
            }}
          >
            {text || 'No text available.'}
          </Typography>
          
          {!readOnly && (
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
              <Button 
                variant="outlined" 
                startIcon={<EditIcon />} 
                onClick={handleEdit}
                sx={{ mr: 1 }}
              >
                Edit
              </Button>
            </Box>
          )}
        </>
      )}
      
      {!readOnly && onGenerateRequest && (
        <Box sx={{ mt: 3, pt: 2, borderTop: '1px solid #eee' }}>
          <Typography variant="subtitle2" gutterBottom>
            Generate AI Response
          </Typography>
          <TextField
            fullWidth
            placeholder="Optional prompt for the AI (leave empty for default generation)"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            variant="outlined"
            size="small"
            sx={{ mb: 2 }}
          />
          <Button
            variant="contained"
            color="secondary"
            startIcon={isGenerating ? <CircularProgress size={20} color="inherit" /> : <AutoFixHighIcon />}
            onClick={handleGenerateRequest}
            disabled={isGenerating}
          >
            {isGenerating ? 'Generating...' : 'Generate Response'}
          </Button>
        </Box>
      )}
    </Paper>
  );
};

export default TextEditor; 