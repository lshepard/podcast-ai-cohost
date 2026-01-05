const localtunnel = require('localtunnel');

(async () => {
  try {
    const tunnel = await localtunnel({ port: 3000 });
    console.log('');
    console.log('========================================');
    console.log('Localtunnel is now running!');
    console.log('Public URL:', tunnel.url);
    console.log('========================================');
    console.log('');
    console.log('Press Ctrl+C to stop the tunnel');

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
    console.error('Error starting tunnel:', err.message);
    process.exit(1);
  }
})();
