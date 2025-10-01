const express = require('express');
require('dotenv').config();

const app = express();
app.use(express.json());

app.get('/', (req, res) => {
    res.send('<h1>🤖 Simple Test Server</h1><p>Server is working!</p>');
});

app.get('/test', (req, res) => {
    res.json({ status: 'ok', message: 'Server is responding' });
});

const PORT = 3003;

app.listen(PORT, () => {
    console.log(`🎉 SIMPLE TEST SERVER RUNNING!`);
    console.log(`🌐 Open: http://localhost:${PORT}`);
    console.log(`🧪 Test: http://localhost:${PORT}/test`);
});

process.on('SIGINT', () => {
    console.log('\n🛑 Server stopped');
    process.exit(0);
});