import { aiResponseStream } from '../utils/ai.js';

const SYSTEM_PROMPT = "You are a helpful assistant. This conversation is being translated to voice, so answer carefully. When you respond, please spell out all numbers, for example twenty not 20. Do not include emojis in your responses. Do not include bullet points, asterisks, or special symbols. Keep your responses concise and direct.";
const sessions = new Map();

function handleInterrupt(callSid, utteranceUntilInterrupt) {
  const sessionData = sessions.get(callSid);
  let conversation = sessionData.conversation;
  
  // Find the last assistant message that contains the interrupted utterance
  const interruptedIndex = conversation.findIndex(
    (message) =>
      message.role === "assistant" &&
      message.content.includes(utteranceUntilInterrupt)
  );
  
  if (interruptedIndex !== -1) {
    const interruptedMessage = conversation[interruptedIndex];
    const interruptPosition = interruptedMessage.content.indexOf(utteranceUntilInterrupt);
    const truncatedContent = interruptedMessage.content.substring(
      0,
      interruptPosition + utteranceUntilInterrupt.length
    );
    
    // Update the interrupted message with truncated content
    conversation[interruptedIndex] = {
      ...interruptedMessage,
      content: truncatedContent
    };
    
    // Remove any subsequent assistant messages
    conversation = conversation.filter(
      (message, index) =>
        !(index > interruptedIndex && message.role === "assistant")
    );
  }
  
  sessionData.conversation = conversation;
  sessions.set(callSid, sessionData);
}

export default async function websocketRoutes(fastify) {
  fastify.get("/ws", { websocket: true }, (ws, req) => {
    ws.on("message", async (data) => {
      const message = JSON.parse(data);

      switch (message.type) {
        case "setup":
          const callSid = message.callSid;
          console.log("Setup for call:", callSid);
          ws.callSid = callSid;
          sessions.set(callSid, {
            conversation: [{ role: "system", content: SYSTEM_PROMPT }]
          });
          break;
          
        case "prompt":
          console.log("Processing prompt:", message.voicePrompt);
          const sessionData = sessions.get(ws.callSid);
          sessionData.conversation.push({ role: "user", content: message.voicePrompt });
          const response = await aiResponseStream(sessionData.conversation, ws);
          if (response) {
            sessionData.conversation.push({ role: "assistant", content: response });
          }
          break;
          
        case "interrupt":
          console.log("Handling interruption; last utterance:", message.utteranceUntilInterrupt);
          handleInterrupt(ws.callSid, message.utteranceUntilInterrupt);
          break;
          
        default:
          console.warn("Unknown message type received:", message.type);
          break;
      }
    });

    ws.on("close", () => {
      console.log("WebSocket connection closed");
      sessions.delete(ws.callSid);
    });
  });
} 
