const bedrock = require('bedrock-protocol');
const http = require('http');

const webPort = process.env.PORT || 8080;
http.createServer((req, res) => {
  res.writeHead(200);
  res.end('Bot is active');
}).listen(webPort, '0.0.0.0', () => {
  console.log(`[Web] Health check server listening on port ${webPort}`);
});

const config = {
  host: process.env.MC_HOST || '157.90.5.77',
  port: parseInt(process.env.MC_PORT) || 11160,
  username: process.env.MC_USERNAME || 'AFKBot',
  offline: false,
  profilesFolder: './auth',
  afkMode: process.env.AFK_MODE || 'passive', 
  afkMessage: process.env.AFK_MESSAGE || 'I am AFK',
  reconnectDelay: 30000,
  maxReconnectAttempts: 50
};

let client = null;
let reconnectAttempts = 0;
let antiAfkInterval = null;

function startAntiAfk() {
  if (antiAfkInterval) clearInterval(antiAfkInterval);
  console.log(`[Anti-AFK] Starting in ${config.afkMode.toUpperCase()} mode`);
  antiAfkInterval = setInterval(() => {
    if (!client) return;
    if (config.afkMode === 'active') {
      try {
        client.queue('text', {
          type: 'chat', 
          needs_translation: false, 
          source_name: client.username, 
          xuid: '', 
          platform_chat_id: '',
          message: `[Bot] ${config.afkMessage} - ${new Date().toLocaleTimeString()}`
        });
        console.log(`[Anti-AFK] Sent active ping: ${config.afkMessage}`);
      } catch (err) {
        console.error(`[Anti-AFK] Error: ${err.message}`);
      }
    } else {
      console.log('[Anti-AFK] Bot is connected and chilling...');
    }
  }, 60000);
}

function stopAntiAfk() {
  if (antiAfkInterval) {
    clearInterval(antiAfkInterval);
    antiAfkInterval = null;
  }
}

function connect() {
  console.log(`[Bot] Connecting to ${config.host}:${config.port}...`);
  try {
    client = bedrock.createClient({
      host: config.host,
      port: config.port,
      username: config.username,
      offline: config.offline,
      skipPing: true,
      profilesFolder: config.profilesFolder,
      conLog: console.log 
    });

    client.on('join', () => {
      console.log('âœ… [Bot] Successfully joined!');
      reconnectAttempts = 0;
      startAntiAfk();
    });

    client.on('spawn', () => console.log('ðŸŒ [Bot] Spawned!'));

    client.on('disconnect', (packet) => {
      console.warn(`âš ï¸ [Bot] Disconnected: ${packet.message}`);
      stopAntiAfk();
      scheduleReconnect();
    });

    client.on('kick', (reason) => {
      console.warn(`ðŸ›‘ [Bot] Kicked: ${reason.message}`);
      stopAntiAfk();
      scheduleReconnect();
    });

    client.on('error', (err) => {
      console.error(`âŒ [Bot] Error: ${err.message}`);
      stopAntiAfk();
    });

    client.on('close', () => {
      stopAntiAfk();
      scheduleReconnect();
    });

  } catch (err) {
    console.error(`âŒ [Bot] Failed: ${err.message}`);
    scheduleReconnect();
  }
}

function scheduleReconnect() {
  if (reconnectAttempts >= config.maxReconnectAttempts) {
    console.error('ðŸš¨ Max attempts reached. Waiting 5m...');
    reconnectAttempts = 0;
    setTimeout(connect, 300000); 
    return;
  }
  reconnectAttempts++;
  const delay = Math.min(config.reconnectDelay * reconnectAttempts, 300000); 
  console.log(`ðŸ”„ Reconnecting in ${delay / 1000}s...`);
  setTimeout(connect, delay);
}

const shutdown = () => {
  stopAntiAfk();
  if (client) client.close();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

connect();
