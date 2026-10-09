import { spawn } from "node:child_process";
const command = process.argv[2] === "preview" ? "preview" : "dev";
const children = ["@onebite/pos", "@onebite/admin"].map((name) =>
  spawn("npm", ["run", command, "--workspace", name], { stdio: "inherit" }),
);
const stop = () => children.forEach((child) => child.kill("SIGTERM"));
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
children.forEach((child) =>
  child.on("exit", (code) => {
    if (code) {
      stop();
      process.exitCode = code;
    }
  }),
);
