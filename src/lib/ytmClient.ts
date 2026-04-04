import YTMusic from "ytmusic-api";

let ytmusicInstance: YTMusic | null = null;

/**
 * Initializes and returns a singleton YTMusic instance.
 * Sets necessary headers and authentication to avoid 400 errors.
 */
export async function getYTMusic() {
  if (!ytmusicInstance) {
    ytmusicInstance = new YTMusic();
    
    // Support for authenticated requests via cookie
    const cookie = process.env.YTM_COOKIE;
    
    // Unofficial APIs often need a specific User-Agent and Client headers for InnerTube
    try {
      if (cookie) {
        console.log("[ytmClient] Initializing with cookie-based authentication");
        await (ytmusicInstance as any).initialize({ 
          cookies: cookie,
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "X-Youtube-Client-Name": "67",
            "X-Youtube-Client-Version": "1.20240101.01.00"
          }
        });
      } else {
        await ytmusicInstance.initialize();
      }
    } catch (err) {
      console.error("[ytmClient] Initialization failed:", err);
      ytmusicInstance = new YTMusic();
      await ytmusicInstance.initialize();
    }
  }
  return ytmusicInstance;
}
