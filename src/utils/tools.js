// Tool definitions for function calling
// Following HuggingFace Inference Providers API specification
export const tools = [
  {
    type: "function",
    function: {
      name: "get_programming_joke",
      description: "Get a random programming joke from an API",
      parameters: {
        type: "object",
        properties: {
          category: {
            type: "string",
            description: "The category of joke to fetch",
            enum: ["programming"]
          }
        },
        required: ["category"]
      }
    }
  }
];

// Tool implementations
export async function executeTool(toolName, toolArgs) {
  switch (toolName) {
    case "get_programming_joke":
      return await getProgrammingJoke();
    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}

async function getProgrammingJoke() {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    
    const response = await fetch(`https://v2.jokeapi.dev/joke/Programming?safe-mode`, {
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.error) {
      return `Sorry, I couldn't fetch a joke right now. Error: ${data.message}`;
    }
    
    if (data.type === "single") {
      return data.joke;
    } else if (data.type === "twopart") {
      return `${data.setup} ${data.delivery}`;
    } else {
      return "Sorry, I couldn't get a proper joke format.";
    }
  } catch (error) {
    console.error("Error fetching programming joke:", error);
    
    if (error.name === 'AbortError') {
      return "Sorry, the joke service is taking too long to respond. Let me try a different approach.";
    } else if (error.code === 'ETIMEDOUT') {
      return "Sorry, the joke service is currently unavailable due to a network timeout.";
    } else {
      return "Sorry, I couldn't fetch a joke right now due to a network error. Let me try to help you in a different way.";
    }
  }
} 
