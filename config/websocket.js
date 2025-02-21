// config/websocket.js
const WebSocket = require('ws');
const { handleLordBountyUpdates } = require('../services/timerService');

const initializeWebSocket = (server) => {
    const wss = new WebSocket.Server({ server });

    wss.on('connection', (ws) => {
        console.log('New client connected');

        ws.on('message', (message) => {
            try {
                const data = JSON.parse(message.toString());
                if (data.type === 'lord_subscribe_bounties' && data.lordId) {
                    handleLordBountyUpdates(ws, data.lordId);
                }
            } catch (error) {
                console.error('WebSocket message error:', error);
            }
        });

        ws.on('close', () => {
            console.log('Client disconnected');
        });
    });

    return wss;
};


module.exports = initializeWebSocket;