import { HfInference } from '@huggingface/inference';

const hf = new HfInference(process.env.HUGGING_FACE_ACCESS_TOKEN);
const endpoint = hf.endpoint(process.env.HUGGING_FACE_ENDPOINT_URL);

function logToken(count, token) {
  const paddedCount = count.toString().padStart(3, '0');
  const trimmedToken = token.trimStart();
  console.log(`${paddedCount}: ${trimmedToken}`);
}

export async function aiResponseStream(conversation, ws) {
  try {
    const stream = await endpoint.chatCompletionStream({
      messages: conversation,
      parameters: {
        max_new_tokens: 250,
        return_full_text: false,
        temperature: 0.7,
        top_p: 0.95,
        do_sample: true
      }
    });
    
    let fullResponse = '';
    let tokenCount = 0;
    
    for await (const chunk of stream) {
      const token = chunk.choices[0].delta.content;
      if (token) {
        tokenCount++;
        logToken(tokenCount, token);
        fullResponse += token;
        ws.send(
          JSON.stringify({
            type: "text",
            token,
            last: false
          })
        );
      }
    }

    // Send final message to indicate completion
    ws.send(
      JSON.stringify({
        type: "text",
        token: "",
        last: true
      })
    );
    
    return fullResponse;
  } catch (error) {
    console.error('Error in streaming response:', error);
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
