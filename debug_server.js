// Simple debug version of the server to identify issues
console.log('🔍 Starting server debug...');

try {
    require('dotenv').config();
    console.log('✅ Environment loaded');
    
    const express = require('express');
    console.log('✅ Express loaded');
    
    const mongoose = require('mongoose');
    console.log('✅ Mongoose loaded');
    
    const app = express();
    app.use(express.json());
    console.log('✅ Express app created');
    
    // Test database connection
    mongoose.connect(process.env.MONGODB_URI)
        .then(() => console.log('✅ Database connected'))
        .catch(err => {
            console.error('❌ Database error:', err.message);
            process.exit(1);
        });
    
    // Basic route
    app.get('/', (req, res) => {
        res.send('🎉 Server is working!');
    });
    
    // Start server
    const PORT = 3003;
    app.listen(PORT, () => {
        console.log(`🎉 DEBUG SERVER RUNNING ON PORT ${PORT}`);
        console.log(`🌐 Test: http://localhost:${PORT}`);
    });
    
} catch (error) {
    console.error('❌ Server startup error:', error);
    process.exit(1);
}