#!/usr/bin/env node

// Simple startup script for your attendance chatbot
const fs = require('fs');
const path = require('path');

console.log('🤖 Starting Attendance Chatbot...');
console.log('=====================================\n');

// Check if .env file exists
const envPath = path.join(__dirname, '.env');
if (!fs.existsSync(envPath)) {
  console.error('❌ Missing .env file! Please create one with your configuration.');
  process.exit(1);
}

// Load environment variables
require('dotenv').config();

// Check essential environment variables
const requiredEnvVars = ['MONGODB_URI', 'PORT'];
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.error('❌ Missing required environment variables:', missingVars.join(', '));
  console.error('Please check your .env file.');
  process.exit(1);
}

// Check if OpenAI key is configured (warning, not error)
if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'your_openai_api_key_here') {
  console.warn('⚠️  OpenAI API key not configured. Document processing will not work.');
  console.warn('   Get your API key from: https://platform.openai.com/api-keys');
  console.warn('   Add it to your .env file as OPENAI_API_KEY=your_actual_key\n');
}

console.log('✅ Environment check complete!');
console.log('🚀 Starting the bot...\n');

// Start the main application
require('./app_Version2.js');