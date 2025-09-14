import express from 'express';
import cors from 'cors';

const app = express();
const PORT = 3001;

// Enable CORS for all origins
app.use(cors());
app.use(express.json());

// Store events in memory (in production, use Redis or database)
const callEvents = new Map();

// GET endpoint for testing webhook availability
app.get('/webhook', (req, res) => {
  res.json({
    status: 'active',
    message: 'VOX Webhook Server is running',
    endpoint: 'POST /webhook',
    totalCalls: callEvents.size,
    timestamp: new Date().toISOString()
  });
});

// VAPI webhook endpoint
app.post('/webhook', (req, res) => {
  const event = req.body;
  const timestamp = new Date().toISOString();

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📡 VAPI Webhook Event Received at ${timestamp}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  // Log event type and call ID
  if (event.type) {
    console.log(`📌 Event Type: ${event.type}`);
  }
  if (event.call?.id) {
    console.log(`📞 Call ID: ${event.call.id}`);
  }

  // Handle different VAPI event types
  switch (event.type) {
    case 'call-started':
      console.log('✅ Call Started');
      console.log(`   Phone Number: ${event.call?.phoneNumber || 'N/A'}`);
      console.log(`   Assistant: ${event.call?.assistant?.name || 'N/A'}`);
      break;

    case 'transcript':
      console.log('💬 Transcript Update');
      if (event.transcript) {
        console.log(`   Role: ${event.transcript.role}`);
        console.log(`   Text: ${event.transcript.text || event.transcript.content}`);
      }
      // Also check for message field
      if (event.message) {
        console.log(`   Message Role: ${event.message.role}`);
        console.log(`   Message Text: ${event.message.content || event.message.text}`);
      }
      break;

    case 'conversation-update':
      console.log('🔄 Conversation Update');
      if (event.messages && event.messages.length > 0) {
        console.log(`   Total Messages: ${event.messages.length}`);
        // Log all recent messages, not just the last one
        const recentMessages = event.messages.slice(-3); // Last 3 messages
        recentMessages.forEach((msg, index) => {
          console.log(`   Message ${index + 1}:`);
          console.log(`     Role: ${msg.role}`);
          console.log(`     Content: ${msg.content || msg.text || msg.message}`);
        });
      }
      break;

    case 'message':
      console.log('📨 Message Event');
      if (event.message) {
        console.log(`   Role: ${event.message.role}`);
        console.log(`   Content: ${event.message.content || event.message.text}`);
      }
      break;

    case 'speech-update':
      console.log('🎤 Speech Update');
      console.log(`   Status: ${event.status}`);
      if (event.transcript) {
        console.log(`   Current Speech: ${event.transcript}`);
      }
      break;

    case 'function-call':
      console.log('🔧 Function Call');
      console.log(`   Function: ${event.functionCall?.name}`);
      console.log(`   Arguments: ${JSON.stringify(event.functionCall?.arguments)}`);
      break;

    case 'status-update':
      console.log('📊 Status Update');
      console.log(`   Status: ${event.status}`);
      break;

    case 'tool-calls':
      console.log('🛠️ Tool Calls');
      if (event.toolCalls && Array.isArray(event.toolCalls)) {
        event.toolCalls.forEach((tool, index) => {
          console.log(`   Tool ${index + 1}: ${tool.function?.name}`);
        });
      }
      break;

    case 'hang':
      console.log('📴 Call Ended');
      console.log(`   Reason: ${event.reason || 'User hung up'}`);
      break;

    case 'voice-input':
      console.log('🎙️ Voice Input Detected');
      break;

    case 'user-interrupted':
      console.log('⚠️ User Interrupted Assistant');
      break;

    default:
      console.log(`❓ Unknown Event Type: ${event.type}`);
  }

  // Log full event details for debugging
  console.log('\n📄 Full Event Payload:');
  console.log(JSON.stringify(event, null, 2));
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Store event for retrieval by frontend
  if (event.call?.id) {
    const callId = event.call.id;
    if (!callEvents.has(callId)) {
      callEvents.set(callId, []);
    }
    callEvents.get(callId).push({
      ...event,
      receivedAt: timestamp
    });
  }

  // Send proper response to VAPI
  res.status(200).json({
    received: true,
    timestamp: timestamp
  });
});

// Endpoint to retrieve events for a specific call
app.get('/events/:callId', (req, res) => {
  const { callId } = req.params;
  const events = callEvents.get(callId) || [];
  res.json({ events });
});

// Clear events for a call
app.delete('/events/:callId', (req, res) => {
  const { callId } = req.params;
  callEvents.delete(callId);
  res.json({ cleared: true });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    totalCalls: callEvents.size
  });
});

app.listen(PORT, () => {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🚀 VOX Webhook Server Started');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📡 Webhook URL: http://localhost:${PORT}/webhook`);
  console.log(`🔍 Health Check: http://localhost:${PORT}/health`);
  console.log(`📊 Events API: http://localhost:${PORT}/events/:callId`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('⏳ Waiting for VAPI webhook events...\n');
});
