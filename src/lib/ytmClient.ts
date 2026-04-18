import YTMusic from "ytmusic-api";

let ytmusicInstance: YTMusic | null = null;

/**
 * Initializes and returns a singleton YTMusic instance.
 * Sets necessary headers and authentication to avoid 400 errors.
 */
export async function getYTMusic() {
  if (!ytmusicInstance) {
    const instance = new YTMusic();
    const cookie = process.env.YTM_COOKIE;
    
    const init = async () => {
      try {
        if (cookie) {
          await (instance as any).initialize({ 
            cookies: cookie,
            headers: {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
              "X-Youtube-Client-Name": "67",
              "X-Youtube-Client-Version": "1.20240416.01.00"
            }
          });
        } else {
          await instance.initialize();
        }
      } catch (e) {
        console.error("[ytmClient] Initial init failed", e);
      }
    };

    await init();

    // Verification: Check if the instance actually got a key
    const internalKey = (instance as any).yt?.apiKey;
    if (!internalKey) {
      console.warn("[ytmClient] Initialized instance has no API key, retrying...");
      await instance.initialize();
    }
    
    ytmusicInstance = instance;
  }
  return ytmusicInstance!;
}
