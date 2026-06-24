import { createServer } from "http";

const port = Number(process.env.PORT) || 8080;

const server = createServer((_req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("Workers running");
});

server.listen(port, () => {
  console.log(`[workers] health check listening on port ${port}`);
});

void import("./index");
