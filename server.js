const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 8080;

const server = http.createServer(async (req, res) => {
  // API proxy
  if (req.method === "POST" && req.url === "/api/messages") {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", async () => {
      try {
        const parsed = JSON.parse(body);
        delete parsed.apiKey;

        const apiKey = process.env.ANTHROPIC_API_KEY;
        if (!apiKey) {
          res.writeHead(500, {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          });
          res.end(JSON.stringify({ error: "伺服器未設定 ANTHROPIC_API_KEY 環境變數" }));
          return;
        }

        const postData = JSON.stringify(parsed);
        const options = {
          hostname: "api.anthropic.com",
          port: 443,
          path: "/v1/messages",
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(postData),
            "x-api-key": apiKey,
            "anthropic-version": "2025-01-01",
          },
          timeout: 120000, // 120 second connection timeout
        };

        const apiReq = https.request(options, (apiRes) => {
          // Collect full response to avoid pipe issues
          let responseData = "";
          apiRes.on("data", (chunk) => (responseData += chunk));
          apiRes.on("end", () => {
            res.writeHead(apiRes.statusCode, {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
            });
            res.end(responseData);
          });
        });

        // Timeout handling
        apiReq.on("timeout", () => {
          apiReq.destroy();
          if (!res.headersSent) {
            res.writeHead(504, {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
            });
            res.end(JSON.stringify({ error: "API 回應超時，請重試" }));
          }
        });

        apiReq.on("error", (e) => {
          console.error("API request error:", e.message);
          if (!res.headersSent) {
            res.writeHead(502, {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
            });
            res.end(JSON.stringify({ error: `API 連線錯誤: ${e.message}` }));
          }
        });

        apiReq.write(postData);
        apiReq.end();
      } catch (e) {
        console.error("Parse error:", e.message);
        if (!res.headersSent) {
          res.writeHead(400, {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          });
          res.end(JSON.stringify({ error: e.message }));
        }
      }
    });
    return;
  }

  // CORS preflight
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });
    res.end();
    return;
  }

  // Serve static files
  let filePath = req.url === "/" ? "/index.html" : req.url;
  filePath = path.join(__dirname, filePath);
  const ext = path.extname(filePath);
  const mimeTypes = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css",
    ".js": "application/javascript",
    ".json": "application/json",
    ".png": "image/png",
    ".ico": "image/x-icon",
  };

  try {
    const content = fs.readFileSync(filePath);
    res.writeHead(200, { "Content-Type": mimeTypes[ext] || "text/plain" });
    res.end(content);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not Found");
  }
});

// Server-level timeout (2 minutes for long web searches)
server.timeout = 120000;
server.keepAliveTimeout = 120000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
