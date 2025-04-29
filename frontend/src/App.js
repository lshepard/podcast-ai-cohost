import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { AppBar, Box, Container, Toolbar, Typography, Button } from '@mui/material';
import EpisodeList from './pages/EpisodeList';
import EpisodeEditor from './components/EpisodeEditor';

// Create a theme
const theme = createTheme({
  palette: {
    primary: {
      main: '#2196f3',
    },
    secondary: {
      main: '#ff4081',
    },
    background: {
      default: '#f5f5f5',
    },
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    h4: {
      fontWeight: 600,
    },
  },
});

function EpisodeEditorPage() {
  const path = window.location.pathname;
  const matches = path.match(/\/episodes\/(\d+)/);
  
  if (matches && matches[1]) {
    return <EpisodeEditor episodeId={parseInt(matches[1], 10)} />;
  }
  
  return <Navigate to="/" replace />;
}

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Router>
        <Box sx={{ flexGrow: 1 }}>
          <AppBar position="static">
            <Toolbar>
              <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
                Podcast Recording App
              </Typography>
              <Button color="inherit" href="/">Episodes</Button>
            </Toolbar>
          </AppBar>
          
          <Container>
            <Routes>
              <Route path="/" element={<EpisodeList />} />
              <Route path="/episodes/:id" element={<EpisodeEditorPage />} />
            </Routes>
          </Container>
        </Box>
      </Router>
    </ThemeProvider>
  );
}

export default App; 