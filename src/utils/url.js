export function getWebSocketUrl(hostUrl) {
  const domain = hostUrl.replace(/^https?:\/\//, '');
  return `wss://${domain}/ws`;
} 
