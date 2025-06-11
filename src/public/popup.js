document
  .getElementById("tokenForm")
  .addEventListener("submit", function (event) {
    event.preventDefault();
    const token = document.getElementById("token").value;

    // Save the token to local storage
    chrome.storage.local.set({ anilistToken: token }, function () {
      console.log("Token saved:", token);
      alert("Token saved successfully!");
    });
  });
