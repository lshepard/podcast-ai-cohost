import React, { useState } from 'react';
import {
  Box,
  Button,
  TextField,
  Typography,
  IconButton,
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import EditIcon from '@mui/icons-material/Edit';

const NotesEditor = ({ notes, onSave, isEditing, onEditChange }) => {
  const [editedNotes, setEditedNotes] = useState(notes || '');

  const handleSave = () => {
    onSave(editedNotes);
    onEditChange(false);
  };

  return (
    <Box>
      {isEditing ? (
        <Box>
          <TextField
            fullWidth
            multiline
            rows={10}
            value={editedNotes}
            onChange={(e) => setEditedNotes(e.target.value)}
            placeholder="Enter episode notes, script, and important information here..."
            variant="outlined"
          />
          <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              variant="outlined"
              onClick={() => {
                setEditedNotes(notes || '');
                onEditChange(false);
              }}
              sx={{ mr: 1 }}
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              startIcon={<SaveIcon />}
              onClick={handleSave}
            >
              Save Notes
            </Button>
          </Box>
        </Box>
      ) : (
        <Typography
          variant="body1"
          sx={{
            whiteSpace: 'pre-wrap',
            minHeight: '100px',
            p: 2,
            bgcolor: 'background.paper',
            borderRadius: 1,
          }}
        >
          {notes || 'No notes added yet. Click the edit icon to add notes and script information.'}
        </Typography>
      )}
    </Box>
  );
};

export default NotesEditor; 