// Background service worker to proxy API requests to local network
export {};

declare const __ANIDUB_API_URL__: string;
const API_URL = `${__ANIDUB_API_URL__}/dubs`;

// Handle messages from content scripts
chrome.runtime.onMessage.addListener(
  (
    message: { type: string; payload?: unknown },
    sender: chrome.runtime.MessageSender,
    sendResponse: (response: unknown) => void,
  ) => {
    (async () => {
      try {
        if (message.type === "FETCH_DUB_LIST") {
          const token = await getAuthToken();
          if (!token) {
            sendResponse({ error: "No auth token" });
            return;
          }

          const res = await fetch(`${API_URL}/list`, {
            headers: { Authorization: token },
          });

          if (!res.ok) {
            const errorData = await res.json().catch(() => ({}));
            sendResponse({ error: errorData.error || res.statusText });
            return;
          }

          const data = await res.json();
          sendResponse(data);
        } else if (message.type === "FETCH_DUB_STATUS") {
          const { id } = message.payload as { id: string };
          const token = await getAuthToken();
          if (!token) {
            sendResponse({ error: "No auth token" });
            return;
          }

          const res = await fetch(`${API_URL}/${id}`, {
            headers: { Authorization: token },
          });

          if (!res.ok) {
            const errorData = await res.json().catch(() => ({}));
            sendResponse({ error: errorData.error || res.statusText });
            return;
          }

          const data = await res.json();
          sendResponse(data);
        }
      } catch (err) {
        console.error("Background script error:", err);
        sendResponse({ error: String(err) });
      }
    })();

    return true; // Keep message channel open for async response
  },
);

async function getAuthToken(): Promise<string | null> {
  try {
    const result = await chrome.storage.local.get("anidub_nonce");
    return result.anidub_nonce ?? null;
  } catch (err) {
    console.warn("Error getting auth token:", err);
    return null;
  }
}
