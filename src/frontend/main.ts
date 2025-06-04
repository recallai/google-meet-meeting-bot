// get DOM elements for form, input field, and status
const form = document.getElementById("meeting-form") as HTMLInputElement;
const input = document.getElementById("url") as HTMLInputElement;
const statusElem = document.getElementById("status") as HTMLInputElement;

// listen for form submission
form.addEventListener("submit", async (e) => {
  // prevent page refresh, get url from user
  e.preventDefault();
  const url = input.value;

  statusElem.innerText = "Submitting";
  try {
    // send url to backend
    const res = await fetch(`http://localhost:3000/submit-link`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: url }),
    });
    // display response text from server
    const inputText = await res.text();
    statusElem.innerText = inputText;
  } catch {
    // basic error if request fails
    statusElem.innerText = `Error occurred`;
  }
});
