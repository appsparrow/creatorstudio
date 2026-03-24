export interface NanoBananaGenerateRequest {
  prompt: string;
  type: 'TEXTTOIAMGE' | 'IMAGETOIAMGE';
  numImages?: number;
  image_size?: '1:1' | '4:5' | '16:9';
  imageUrls?: string[];
  callBackUrl?: string;
}

export interface NanoBananaResponse {
  code: number;
  message: string;
  data: {
    taskId: string;
    successFlag: number; // 0: Generating, 1: Success, 2: Task Failed, 3: Generation Failed
    response?: {
      resultImageUrl?: string;
    }
  }
}

const BASE_URL = 'https://api.nanobananaapi.ai';

export async function generateImageNanoBanana(request: NanoBananaGenerateRequest, apiKey: string): Promise<string> {
  const endpoint = request.type === 'IMAGETOIAMGE' ? '/api/v1/nanobanana/generate' : '/api/v1/nanobanana/generate'; // Both use same endpoint usually, or check v2
  // Wait, let's use nanobanana or nanobanana2. The user might want either. Let's use /api/v1/nanobanana/generate as base.
  
  const headers = {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json'
  };

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      ...request,
      numImages: request.numImages || 1,
      image_size: request.image_size || '4:5',
    })
  });

  const data: NanoBananaResponse = await response.json();
  if (data.code !== 200) {
    throw new Error(`NanoBanana API Error: ${data.message}`);
  }

  const taskId = data.data.taskId;
  console.log(`NanoBanana Task ID: ${taskId}`);

  // Polling mechanism
  const pollInterval = 5000; // 5 seconds
  const maxAttempts = 30; // 2.5 minutes
  let attempts = 0;

  while (attempts < maxAttempts) {
    await new Promise(resolve => setTimeout(resolve, pollInterval));
    attempts++;

    const statusResponse = await fetch(`${BASE_URL}/api/v1/nanobanana/record-info?taskId=${taskId}`, {
      headers
    });
    const statusData: NanoBananaResponse = await statusResponse.json();

    if (statusData.data.successFlag === 1) {
      if (statusData.data.response?.resultImageUrl) {
        return statusData.data.response.resultImageUrl;
      } else {
        throw new Error("NanoBanana generation succeeded but no image URL returned.");
      }
    } else if (statusData.data.successFlag === 2 || statusData.data.successFlag === 3) {
      throw new Error("NanoBanana image generation failed.");
    }
    // 0 means still generating
    console.log(`Polling NanoBanana... Attempt ${attempts}/${maxAttempts}`);
  }

  throw new Error("NanoBanana image generation timed out.");
}
