import 'dotenv/config';
import Fastify from "fastify";
import fastifyWs from "@fastify/websocket";
import { getWebSocketUrl } from './src/utils/url.js';
import websocketRoutes from './src/routes/websocket.js';
import twimlRoutes from './src/routes/twiml.js';

const PORT = process.env.PORT || 8080;

const fastify = Fastify();
fastify.register(fastifyWs);
fastify.register(twimlRoutes);
fastify.register(websocketRoutes);

try {
  fastify.listen({ port: PORT });
  console.log(`Server running at:
  - http://localhost:${PORT}
  - ${process.env.HOST}
  - ${getWebSocketUrl(process.env.HOST)}`);
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}
