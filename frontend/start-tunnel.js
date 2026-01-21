const localtunnel = require('localtunnel');

(async () => {
  console.log('Starting localtunnel for port 3000...');
  console.log('This may take 10-30 seconds...\n');

  try {
    const tunnel = await localtunnel({
      port: 3000,
      subdomain: null
    });

    console.log('\n========================================');
    console.log('✓ Localtunnel is now running!');
    console.log('========================================');
    console.log('\nPublic URL:', tunnel.url);
    console.log('\nYou can now access your app at the URL above');
    console.log('Press Ctrl+C to stop the tunnel\n');

    tunnel.on('error', (err) => {
      console.error('Tunnel error:', err.message);
    });

    tunnel.on('close', () => {
      console.log('Tunnel closed');
      process.exit(0);
    });

    // Keep the process running
    process.on('SIGINT', () => {
      console.log('\nClosing tunnel...');
      tunnel.close();
    });

  } catch (err) {
    console.error('\n❌ Error starting tunnel:', err.message);
    console.error('\nTroubleshooting:');
    console.error('- Check your internet connection');
    console.error('- Try running: npm install localtunnel');
    console.error('- Or try ngrok: npm install -g ngrok && ngrok http 3000');
    process.exit(1);
  }
})();
