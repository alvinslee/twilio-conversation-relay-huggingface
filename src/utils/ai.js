import { HfInference } from '@huggingface/inference';

const hf = new HfInference(process.env.HUGGING_FACE_ACCESS_TOKEN);
const endpoint = hf.endpoint(process.env.HUGGING_FACE_ENDPOINT_URL);

export async function aiResponse(conversation) {
  try {
    const params = {
      messages: conversation,
      parameters: {
        max_new_tokens: 250,
        temperature: 0.7,
        top_p: 0.95,
        do_sample: true
      }
    };

    const generated_text = await endpoint.chatCompletion(params);
    return generated_text.choices[0].message.content;
  } catch (error) {
    console.error('Error calling Hugging Face API:', error);
    return "I apologize, but I'm having trouble processing your request right now.";
  }
} 
