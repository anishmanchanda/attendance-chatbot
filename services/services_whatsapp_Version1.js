const axios = require('axios');

class WhatsAppService {
  constructor() {
    this.apiVersion = 'v17.0';
    this.phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    this.token = process.env.WHATSAPP_TOKEN;
    this.baseUrl = `https://graph.facebook.com/${this.apiVersion}/${this.phoneNumberId}`;
  }

  async sendMessage(to, text) {
    try {
      const response = await axios({
        method: 'POST',
        url: `${this.baseUrl}/messages`,
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
        data: {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: to,
          type: 'text',
          text: { body: text }
        }
      });
      
      return response.data;
    } catch (error) {
      console.error('Error sending WhatsApp message:', error.response?.data || error.message);
      throw error;
    }
  }

  async handleIncomingMessage(body) {
    try {
      // Extract the message data from the webhook
      if (body.object === 'whatsapp_business_account') {
        const entry = body.entry?.[0];
        const changes = entry?.changes?.[0];
        
        if (changes?.value?.messages?.[0]) {
          const message = changes.value.messages[0];
          const from = message.from;
          const messageText = message.text?.body;
          const messageType = message.type;
          
          // Handle different message types
          if (messageType === 'text') {
            return {
              type: 'text',
              from,
              content: messageText
            };
          } else if (messageType === 'image') {
            const imageId = message.image.id;
            // Get the image URL
            const imageUrl = await this.getMediaUrl(imageId);
            return {
              type: 'image',
              from,
              mediaId: imageId,
              mediaUrl: imageUrl
            };
          } else if (messageType === 'document') {
            const documentId = message.document.id;
            const documentUrl = await this.getMediaUrl(documentId);
            return {
              type: 'document',
              from,
              mediaId: documentId,
              mediaUrl: documentUrl,
              filename: message.document.filename
            };
          }
        }
      }
      
      return null;
    } catch (error) {
      console.error('Error processing incoming message:', error);
      throw error;
    }
  }

  async getMediaUrl(mediaId) {
    try {
      const response = await axios({
        method: 'GET',
        url: `https://graph.facebook.com/${this.apiVersion}/${mediaId}`,
        headers: {
          'Authorization': `Bearer ${this.token}`
        }
      });
      
      const mediaUrl = response.data.url;
      
      // Download the media file
      const mediaResponse = await axios({
        method: 'GET',
        url: mediaUrl,
        headers: {
          'Authorization': `Bearer ${this.token}`
        },
        responseType: 'arraybuffer'
      });
      
      return {
        buffer: mediaResponse.data,
        mimeType: mediaResponse.headers['content-type']
      };
    } catch (error) {
      console.error('Error getting media URL:', error);
      throw error;
    }
  }
}

module.exports = new WhatsAppService();