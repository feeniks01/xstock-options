/**
 * Mock Market Maker for demo
 * Connects to RFQ Router websocket and auto-quotes all RFQs
 */

const WebSocket = require('ws');

const RFQ_WS_URL = process.env.RFQ_WS_URL || 'ws://localhost:3006';
const RFQ_HTTP_URL = process.env.RFQ_HTTP_URL || 'http://localhost:3005';
const PREMIUM_BPS = 100; // 1% premium
const MAKER_PUBKEY = 'mock-mm-demo-maker';

console.log('=================================');
console.log('Mock Market Maker Starting');
console.log('=================================');
console.log(`WS: ${RFQ_WS_URL}`);
console.log(`HTTP: ${RFQ_HTTP_URL}`);
console.log(`Premium: ${PREMIUM_BPS} bps`);
console.log('=================================');

async function registerMaker() {
    try {
        const response = await fetch(`${RFQ_HTTP_URL}/makers`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pubkey: MAKER_PUBKEY }),
        });
        const data = await response.json();
        console.log('[MM] Registered on allowlist:', data);
    } catch (err) {
        console.error('[MM] Failed to register:', err.message);
    }
}

let ws;
let reconnectInterval;

function connect() {
    ws = new WebSocket(RFQ_WS_URL);

    ws.on('open', async () => {
        console.log('[MM] WebSocket connected');

        // Register with the router
        ws.send(JSON.stringify({
            type: 'REGISTER',
            data: { pubkey: MAKER_PUBKEY }
        }));

        if (reconnectInterval) {
            clearInterval(reconnectInterval);
            reconnectInterval = null;
        }
    });

    ws.on('message', (data) => {
        try {
            const msg = JSON.parse(data.toString());
            console.log('[MM] Received:', msg.type);

            // Handle NEW_RFQ (the actual message type from RFQ Router)
            if (msg.type === 'NEW_RFQ' && msg.data) {
                const rfq = msg.data;
                console.log(`[MM] New RFQ: ${rfq.id} - ${rfq.underlying} ${rfq.optionType} @ ${rfq.strike / 1e6}`);

                // Calculate premium: size * premium_bps / 10000
                const premium = Math.floor((rfq.size * PREMIUM_BPS) / 10000);

                // Submit quote after short delay
                setTimeout(() => {
                    const quote = {
                        type: 'QUOTE',
                        data: {
                            rfqId: rfq.id,
                            makerPubkey: MAKER_PUBKEY,
                            premium: premium,
                            validUntilTs: Math.floor(Date.now() / 1000) + 60,
                            signature: 'mock-signature',
                        }
                    };

                    console.log(`[MM] Submitting quote: premium=${premium / 1e6}`);
                    ws.send(JSON.stringify(quote));
                }, 200);
            }

            if (msg.type === 'REGISTERED') {
                console.log('[MM] Successfully registered as maker');
            }

            if (msg.type === 'QUOTE_ACK') {
                console.log(`[MM] Quote acknowledged: ${msg.rfqId}`);
            }

            if (msg.type === 'RFQ_FILLED') {
                console.log(`[MM] 🎉 Filled! Premium: ${msg.data.premium / 1e6}`);
            }

            if (msg.type === 'ERROR') {
                console.error('[MM] Error:', msg.error);
            }
        } catch (err) {
            console.error('[MM] Parse error:', err);
        }
    });

    ws.on('close', () => {
        console.log('[MM] Connection closed, reconnecting...');
        if (!reconnectInterval) {
            reconnectInterval = setInterval(connect, 3000);
        }
    });

    ws.on('error', (err) => {
        console.error('[MM] WebSocket error:', err.message);
    });
}

// First register on allowlist, then connect
registerMaker().then(() => {
    setTimeout(connect, 500);
});

process.on('SIGINT', () => {
    console.log('\n[MM] Shutting down...');
    ws?.close();
    process.exit(0);
});
