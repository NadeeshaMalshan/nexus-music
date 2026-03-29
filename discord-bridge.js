const WebSocket = require('ws');
const RPC = require('discord-rpc');

const wss = new WebSocket.Server({ port: 6543 }); // Port must match discordPresence.ts
const clientId = '1341071985474666579';

console.log('--- NEXUS MUSIC DISCORD BRIDGE ---');
console.log('Listening for browser connections on ws://localhost:6543/discord-rpc');

const rpc = new RPC.Client({ transport: 'ipc' });

rpc.on('ready', () => {
    console.log('Successfully connected to Discord Desktop Client!');
});

rpc.login({ clientId }).catch(err => {
    console.error('Could not connect to Discord. Is Discord running?', err.message);
});

wss.on('connection', (ws) => {
    console.log('Browser connected to bridge.');

    ws.on('message', (message) => {
        const data = JSON.parse(message);
        if (data.type === 'SET_ACTIVITY' && rpc) {
            rpc.setActivity({
                details: data.payload.details,
                state: data.payload.state,
                largeImageKey: data.payload.largeImageKey,
                largeImageText: data.payload.largeImageText,
                startTimestamp: data.payload.startTimestamp,
                instance: false,
            }).catch(console.error);
        } else if (data.type === 'CLEAR_ACTIVITY' && rpc) {
            rpc.clearActivity();
        }
    });
});
