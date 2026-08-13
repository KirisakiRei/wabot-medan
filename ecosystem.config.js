module.exports = {
  apps: [
    {
      name: "wabot-backend",
      cwd: __dirname,
      script: process.env.BUN_BIN || "bun",
      args: "dist/main.js",
      interpreter: "none",
      autorestart: true,
      watch: false,
      time: true,
      max_memory_restart: "512M",
      env: {
        NODE_ENV: "production",
        PORT: process.env.PORT || "8001",
      },
    },
    {
      name: "wabot-nanobot",
      cwd: __dirname,
      script: process.env.NANOBOT_PYTHON || "python3",
      args: "-m uvicorn nanobot.main:app --host 0.0.0.0 --port 8765",
      interpreter: "none",
      autorestart: true,
      watch: false,
      time: true,
      max_memory_restart: "512M",
      env: {
        PYTHONUNBUFFERED: "1",
      },
    },
  ],
};
