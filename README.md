# Voice Assistant with Twilio, HuggingFace, and Tool Calling (Node.js)

(Originally inspired by this [GitHub repo](https://github.com/robinske/cr-demo) from Kelley Robinson at Twilio)

This application demonstrates how to use Node.js, [Twilio Voice](https://www.twilio.com/docs/voice) and [ConversationRelay](https://www.twilio.com/docs/voice/twiml/connect/conversationrelay), and the [Hugging Face Inference API](https://www.npmjs.com/package/@huggingface/inference) with Hugging Face Inference Endpoints to create a voice assistant that can engage in two-way conversations over a phone call with **tool calling capabilities**.

## 🚀 New in Part 3: Tool Calling

This version adds function calling capabilities, allowing your AI assistant to:
- **Fetch real-time data** from external APIs during conversations
- **Tell programming jokes** using the JokeAPI
- **Extend functionality** by adding more tools as needed

The AI can now dynamically call external services and incorporate the results into natural voice responses!

## Prerequisites

To use the app, you will need:

- **Node.js 23.9.0**: Download from [here](https://nodejs.org/).
- **ngrok**: Download and install from [here](https://ngrok.com/docs/getting-started/?os=linux#step-1-install).
- **A Twilio Account**: Sign up for a free trial [here](https://www.twilio.com/try-twilio).
- **A Twilio phone number with Voice Capabilities**: [Instructions to purchase a number](https://support.twilio.com/hc/en-us/articles/223180928-How-to-Buy-a-Twilio-Phone-Number).
- **A Hugging Face account**: With an access token (https://huggingface.co/docs/hub/en/security-tokens) and [billing set up](https://huggingface.co/docs/hub/en/billing) to use [Hugging Face Inference Endpoints](https://huggingface.co/inference-endpoints/dedicated).

## Setup

### 1. Install dependencies

Run the following command to install necessary packages:

```bash
npm install
```

### 2. Prepare environment variables file

Copy the example environment file to `.env`:

```bash
cp .env.example .env
```

### 3. Run ngrok

You'll need to expose your local server to the internet for Twilio to access it. Use ngrok for tunneling:

```bash
ngrok http 8080
```

Copy the forwarding URL (for example: `https://51ff-174-17-28-9.ngrok-free.app`) and set it as the `HOST` in `.env`.

### 4. Create a new Hugging Face Inference Endpoint

Choose the LLM you want to use and [create a new Hugging Face Inference Endpoint](https://endpoints.huggingface.co/catalog) for that model. Then, set the `HUGGING_FACE_ENDPOINT_URL` in `.env` to the newly deployed Hugging Face Inference Endpoint URL.

Create a Hugging Face Access Token and copy that value to `.env`, as the `HUGGING_FACE_ACCESS_TOKEN`. 

### 5. Configure Twilio

Update Your Twilio Phone Number: In the Twilio Console under **Phone Numbers**, set the Webhook for **A call comes in** to your ngrok URL.

Example: `https://51ff-174-17-28-9.ngrok-free.app`

Set the HTTP method for the webhook to be `GET`.

## Run and test the app

Start the server.

```bash
npm start
```

Call your Twilio phone number. After connection, you should be able to converse with the AI-powered AI Assistant, integrated over ConversationRelay with Twilio Voice!

## Architecture

This application builds on the previous parts of the series:

- **Part 1**: Basic voice assistant with HuggingFace and MistralAI
- **Part 2**: Token streaming and interruption handling
- **Part 3**: Tool calling capabilities (this version)

The tool calling system allows the AI to:
1. Recognize when external data is needed
2. Call the appropriate tool function
3. Fetch real-time data from APIs
4. Incorporate the results into natural voice responses

## Adding More Tools

To add more tools, edit `src/utils/tools.js`:
1. Add new tool definitions to the `tools` array
2. Implement the tool function
3. Add the case to the `executeTool` function

Example:
```javascript
// Add to tools array
{
  type: "function",
  function: {
    name: "get_weather",
    description: "Get current weather for a location",
    parameters: {
      type: "object",
      properties: {
        location: {
          type: "string",
          description: "City name"
        }
      },
      required: ["location"]
    }
  }
}

// Add to executeTool function
case "get_weather":
  return await getWeather(toolArgs.location);
```

## Related Blog Posts

This is part 3 of a series on building AI voice assistants with Twilio and HuggingFace:
- [Part 1: Basic AI Agent with ConversationRelay](https://www.twilio.com/en-us/blog/developers/tutorials/product/ai-agent-conversationrelay-voice-mistral)
- [Part 2: Token Streaming and Interruption Handling](https://www.twilio.com/en-us/blog/developers/tutorials/product/token-streaming-interruption-handling-twilio-voice-mistral)
- **Part 3: Tool Calling (this version)**
