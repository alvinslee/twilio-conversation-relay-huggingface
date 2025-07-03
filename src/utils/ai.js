import { HfInference } from '@huggingface/inference';
import { tools, executeTool } from './tools.js';

const hf = new HfInference(process.env.HUGGING_FACE_ACCESS_TOKEN);
const endpoint = hf.endpoint(process.env.HUGGING_FACE_ENDPOINT_URL);

// Generate a 9-character alphanumeric ID for tool calls
function generateToolCallId() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 9; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Reusable function to stream response tokens
async function streamResponse(stream, ws) {
  let response = '';
  
  for await (const chunk of stream) {
    const token = chunk.choices[0].delta.content;
    if (token) {
      response += token;
      ws.send(
        JSON.stringify({
          type: "text",
          token,
          last: false
        })
      );
    }
  }
  
  return response;
}

// Reusable function to stream response tokens and collect tool calls
async function streamResponseWithToolCalls(stream, ws) {
  let response = '';
  let toolCalls = new Map();
  let hasToolCall = false;
  
  for await (const chunk of stream) {
    const token = chunk.choices[0].delta.content;
    const toolCallsFromChunk = chunk.choices[0].delta.tool_calls;
    
    if (token) {
      response += token;
      ws.send(
        JSON.stringify({
          type: "text",
          token,
          last: false
        })
      );
    }
    
    // Collect tool calls - according to the API spec, tool_calls is an array
    if (toolCallsFromChunk && Array.isArray(toolCallsFromChunk) && toolCallsFromChunk.length > 0) {
      hasToolCall = true;
      
      for (const toolCall of toolCallsFromChunk) {
        if (toolCall && toolCall.id) {
          const toolCallId = toolCall.id;
          
          if (!toolCalls.has(toolCallId)) {
            // Initialize new tool call
            const newToolCall = {
              id: toolCallId,
              type: toolCall.type,
              function: {
                name: toolCall.function?.name || '',
                arguments: toolCall.function?.arguments || ''
              }
            };
            toolCalls.set(toolCallId, newToolCall);
          } else {
            // Update existing tool call
            const existingCall = toolCalls.get(toolCallId);
            if (toolCall.function?.name) {
              existingCall.function.name = toolCall.function.name;
            }
            if (toolCall.function?.arguments) {
              existingCall.function.arguments += toolCall.function.arguments;
            }
          }
        }
      }
    }
  }
  
  return { response, toolCalls, hasToolCall };
}

// Reusable function to clean conversation for API calls
function cleanConversationForAPI(conversation) {
  // Clean up conversation to maintain proper user/assistant alternating pattern
  const cleanedConversation = conversation.map(msg => {
    if (msg.role === 'assistant' && msg.tool_calls) {
      // For assistant messages with tool calls, we need to handle them differently
      // We'll skip these messages since the tool result is what matters
      return null;
    } else if (msg.role === 'tool') {
      // Convert tool messages to assistant messages with the tool result as content
      return {
        role: 'assistant',
        content: msg.content
      };
    }
    return msg;
  }).filter(msg => msg !== null); // Remove null messages
  
  // Remove duplicate assistant messages and ensure proper alternating pattern
  const finalCleanedConversation = [];
  const seenAssistantContent = new Set();
  
  for (let i = 0; i < cleanedConversation.length; i++) {
    const msg = cleanedConversation[i];
    
    if (i === 0) {
      // Always keep the first message (system)
      finalCleanedConversation.push(msg);
      continue;
    }
    
    if (msg.role === 'assistant') {
      // For assistant messages, check for duplicates and ensure proper alternating pattern
      if (msg.content && seenAssistantContent.has(msg.content)) {
        // Skip duplicate content
        continue;
      }
      
      // Check if the previous message was also from assistant (consecutive assistant messages)
      if (finalCleanedConversation.length > 0 && 
          finalCleanedConversation[finalCleanedConversation.length - 1].role === 'assistant') {
        continue;
      }
      
      // Add the assistant message
      finalCleanedConversation.push(msg);
      if (msg.content) {
        seenAssistantContent.add(msg.content);
      }
    } else if (msg.role === 'user') {
      // For user messages, check if the previous message was also from user
      if (finalCleanedConversation.length > 0 && 
          finalCleanedConversation[finalCleanedConversation.length - 1].role === 'user') {
        continue;
      }
      
      // Add the user message
      finalCleanedConversation.push(msg);
    } else {
      // For other message types (like system), just add them
      finalCleanedConversation.push(msg);
    }
  }
  
  return finalCleanedConversation;
}

export async function aiResponseStream(conversation, ws) {
  try {
    console.log("\n");
    console.log('=== Starting AI Response Stream ===');
    console.log('Conversation length:', conversation.length);
    console.log('Tools available:', tools.map(t => t.function.name));
    
    const finalCleanedConversation = cleanConversationForAPI(conversation);
    
    // First, try to get a response that might include tool calls
    const stream = await endpoint.chatCompletionStream({
      messages: finalCleanedConversation,
      parameters: {
        max_new_tokens: 250,
        return_full_text: false,
        temperature: 0.7,
        top_p: 0.95,
        do_sample: true
      },
      tools: tools
    });
    
    let { response: fullResponse, toolCalls, hasToolCall } = await streamResponseWithToolCalls(stream, ws);

    // If we have tool calls, execute them
    if (hasToolCall && toolCalls.size > 0) {
      console.log("=== Executing Tool Calls ===");
      
      for (const [toolCallId, call] of toolCalls) {
        if (call && call.function && call.function.name) {
          const toolName = call.function.name;
          let toolArgs;
          
          try {
            // Clean up the arguments string to handle malformed JSON
            let cleanedArgs = call.function.arguments.trim();
            
            // Remove extra commas at the beginning
            cleanedArgs = cleanedArgs.replace(/^\{[\s,]*/, '{');
            
            // Remove extra commas at the end
            cleanedArgs = cleanedArgs.replace(/[\s,]*\}$/, '}');
            
            // Remove extra spaces around colons
            cleanedArgs = cleanedArgs.replace(/\s*:\s*/g, ': ');
            
            toolArgs = JSON.parse(cleanedArgs);
          } catch (error) {
            console.error("Error parsing tool arguments:", call.function.arguments);
            continue;
          }
          
          console.log(`Executing tool: ${toolName} with args:`, toolArgs);
          
          try {
            const toolResult = await executeTool(toolName, toolArgs);
            console.log('Tool execution result:', toolResult);
            
            // Generate a proper tool call ID for the conversation
            const properToolCallId = generateToolCallId();
            
            // Create a new tool call object with the proper ID
            const properToolCall = {
              id: properToolCallId,
              type: call.type,
              function: {
                name: call.function.name,
                arguments: call.function.arguments
              }
            };
            
            // Add tool call and result to conversation
            const assistantMessage = {
              role: "assistant",
              content: null,
              tool_calls: [properToolCall]
            };
            const toolMessage = {
              role: "tool",
              content: toolResult,
              tool_call_id: properToolCallId
            };
            
            conversation.push(assistantMessage);
            conversation.push(toolMessage);
            
            const finalCleanConversation = cleanConversationForAPI(conversation);
            
            const finalStream = await endpoint.chatCompletionStream({
              messages: finalCleanConversation,
              parameters: {
                max_new_tokens: 250,
                return_full_text: false,
                temperature: 0.7,
                top_p: 0.95,
                do_sample: true
              }
            });
            
            fullResponse = await streamResponse(finalStream, ws);
            
            // Remove the tool-related messages from conversation
            conversation.pop(); // Remove the tool message
            conversation.pop(); // Remove the assistant message with tool calls
            
            // If the final response is empty, provide a fallback
            if (!fullResponse || fullResponse.trim() === '') {
              const fallbackResponse = toolResult;
              
              // Send the fallback response
              ws.send(
                JSON.stringify({
                  type: "text",
                  token: fallbackResponse,
                  last: true
                })
              );
              
              fullResponse = fallbackResponse;
            }
            
            // Update the conversation with the final response
            conversation.push({
              role: "assistant",
              content: fullResponse
            });
          } catch (error) {
            console.error("Error executing tool:", error);
            console.error("Error stack:", error.stack);
            
            // Provide a fallback response when tool execution fails
            const fallbackResponse = "I apologize, but I encountered an error while trying to fetch that information. Let me try to help you in a different way.";
            
            ws.send(
              JSON.stringify({
                type: "text",
                token: fallbackResponse,
                last: true
              })
            );
            
            return fallbackResponse;
          }
        }
      }
    } else {
      // No tool calls, log the direct response
      console.log('Final response completed:', fullResponse);
      
      // Update the conversation with the response
      conversation.push({
        role: "assistant",
        content: fullResponse
      });
    }

    // Send final message to indicate completion
    ws.send(
      JSON.stringify({
        type: "text",
        token: "",
        last: true
      })
    );
    
    console.log('=== AI Response Stream Completed ===');
    return fullResponse;
  } catch (error) {
    console.error('Error in streaming response:', error);
    console.error('Error stack:', error.stack);
    ws.send(
      JSON.stringify({
        type: "text",
        token: "I apologize, but I'm having trouble processing your request right now.",
        last: true
      })
    );
    return null;
  }
}
