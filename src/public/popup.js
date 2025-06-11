document.getElementById("tokenForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const token = document.getElementById("token").value.trim();

  if (!token) {
    alert("Please enter a token.");
    return;
  }

  chrome.storage.local.set({ anilistToken: token }, () => {
    console.log("Token saved:", token);
    alert("Token saved successfully!");
  });
});
