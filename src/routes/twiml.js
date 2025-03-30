import { getWebSocketUrl } from '../utils/url.js';

const WELCOME_GREETING = "Hi! I am a voice assistant powered by Twilio and HuggingFace. Ask me anything!";

export default async function twimlRoutes(fastify) {
  fastify.get("/", async (request, reply) => {
    reply.type("text/xml").send(
      `<?xml version="1.0" encoding="UTF-8"?>
      <Response>
        <Connect>
          <ConversationRelay url="${getWebSocketUrl(process.env.HOST)}" welcomeGreeting="${WELCOME_GREETING}" />
        </Connect>
      </Response>`
    );
  });
} 
