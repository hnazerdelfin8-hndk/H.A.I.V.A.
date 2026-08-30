// H.A.I.V.A. Application Loader

console.log("H.A.I.V.A. is starting...");

const app = document.getElementById("haiva-app");

if (!app) {
  throw new Error("H.A.I.V.A. application root not found.");
}

app.innerHTML = `
  <div>
    <h1>H.A.I.V.A.</h1>
    <p>System initializing...</p>
  </div>
`;

console.log("H.A.I.V.A. core loaded.");
