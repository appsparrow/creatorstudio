export interface KlingGenerateRequest {
  prompt: string;
  image_url: string; 
  model_name?: 'kling-v2-5-Turbo' | 'kling-v2-6'; 
  duration?: number; 
}

export async function generateVideoKling(request: KlingGenerateRequest, apiKey: string, apiSecret: string): Promise<string> {
  const BASE_URL = 'https://api.klingai.com'; // Adjust to matching your API Gateway endpoint
  
  console.log(`[Kling] Triggering 5-sec Video Generation for model ${request.model_name}...`);
  
  const headers = {
    'Authorization': `Bearer ${apiKey}`, 
    'Content-Type': 'application/json',
    'x-api-secret': apiSecret // Adding signed secret headers if required by endpoint
  };

  const response = await fetch(`${BASE_URL}/v1/videos/image-to-video`, {
       method: 'POST',
       headers,
       body: JSON.stringify({
           model_name: request.model_name || 'kling-v2-5-Turbo',
           image_url: request.image_url,
           prompt: request.prompt,
           duration: 5
       })
  });

  const data = await response.json();
  const taskId = data.task_id || data.data?.taskId;
  if (!taskId) throw new Error("Kling failed to return task ID");

  console.log(`[Kling] Task ID Created: ${taskId}`);

  // Polling loop
  const pollInterval = 8000; 
  const maxAttempts = 50; 
  let attempts = 0;

  while (attempts < maxAttempts) {
    await new Promise(resolve => setTimeout(resolve, pollInterval));
    attempts++;

    const statusResponse = await fetch(`${BASE_URL}/v1/videos/task-status?id=${taskId}`, { headers });
    const statusData = await statusResponse.json();

    const status = statusData.status || statusData.data?.status;
    const videoUrl = statusData.video_url || statusData.data?.videoUrl;

    if (status === 'SUCCESS' || status === 'COMPLETED' || status === 1) {
        if (videoUrl) return videoUrl;
        throw new Error("Kling succeeded but no video URL returned.");
    } else if (status === 'FAILED' || status === -1) {
        throw new Error("Kling video generation failed on task completion.");
    }
    console.log(`Polling Kling Video... Attempt ${attempts}/${maxAttempts}`);
  }

  throw new Error("Kling video generation timed out.");
}
