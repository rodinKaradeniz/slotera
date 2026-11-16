/** Cross-tab lifecycle signals contain no client identity, content or credentials. */
const KEY = "slotera.client.lifecycle";
const EVENT = "slotera-client-lifecycle";
export function publishClientLifecycle(): void {
  try {
    localStorage.setItem(KEY, crypto.randomUUID());
    localStorage.removeItem(KEY);
  } catch {
    /* Storage can be disabled; BroadcastChannel remains available independently. */
  }
  if (typeof BroadcastChannel !== "undefined") {
    const channel = new BroadcastChannel(KEY);
    channel.postMessage("changed");
    channel.close();
  }
  window.dispatchEvent(new Event(EVENT));
}
export function subscribeClientLifecycle(callback: () => void): () => void {
  const storage = (event: StorageEvent) => {
    if (event.key === KEY && event.newValue) callback();
  };
  window.addEventListener(EVENT, callback);
  window.addEventListener("storage", storage);
  const channel =
    typeof BroadcastChannel !== "undefined" ? new BroadcastChannel(KEY) : null;
  if (channel)
    channel.onmessage = (event) => {
      if (event.data === "changed") callback();
    };
  return () => {
    window.removeEventListener(EVENT, callback);
    window.removeEventListener("storage", storage);
    channel?.close();
  };
}
