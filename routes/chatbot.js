const express = require('express');
const router = express.Router();
const Anthropic = require('@anthropic-ai/sdk');

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY // Your key stays safe on server
});

router.post('/chat', async (req, res) => {
  try {
    const { message, conversationHistory } = req.body;
    
    const response = await anthropic.messages.create({
      model: "claude-3-sonnet-20241022",
      max_tokens: 500,
      temperature: 0.7,
      system: "You're MonaSoap's friendly AI assistant. You know about: organic soaps (5,000-15,000 TZS), shea butter, charcoal soap, delivery to Dar es Salaam (3,000 TZS fee), orders via WhatsApp. Be helpful, brief, and warm. Use basic Swahili greetings like 'Karibu!'",
      messages: conversationHistory || [{ role: "user", content: message }]
    });
    
    res.json({ reply: response.content[0].text });
  } catch (error) {
    console.error('Chatbot error:', error);
    res.status(500).json({ error: 'Sorry, Im having trouble right now. Please try again.' });
  }
});

module.exports = router;