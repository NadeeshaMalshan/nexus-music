const { HfInference } = require('@huggingface/inference');
require('dotenv').config({ path: '.env.local' });
const hf = new HfInference(process.env.HUGGINGFACE_TOKEN);
hf.textGeneration({
  model: 'HuggingFaceH4/zephyr-7b-beta',
  inputs: 'Hello, how are you?',
  parameters: { max_new_tokens: 10 }
}).then(res => console.log('AI Success:', res.generated_text))
  .catch(err => console.error('AI FAILED:', err.message));
