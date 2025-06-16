(async () => {
  const token = document.querySelector("#anidub-nonce");

  if (!token) {
    console.error("Anidub nonce not found in the document.");
    return;
  }

  console.log("Anidub nonce found");

  await chrome.storage.local.set({ anidub_nonce: token.textContent });
})();
