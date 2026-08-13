module.exports = {
  apps: [
    {
      name: "wabot-backend-dev",
      cwd: __dirname,
      script: process.env.BUN_BIN || "bun",
      args: "dist/main.js",
      interpreter: "none",
      autorestart: true,
      watch: false,
      time: true,
      max_memory_restart: "512M",
      env: {
        NODE_ENV: "development",
        PORT: process.env.DEV_BACKEND_PORT || "8011",
        NANOBOT_ENGINE_URL: process.env.DEV_NANOBOT_ENGINE_URL || "http://127.0.0.1:8766",
      },
    },
    {
      name: "wabot-nanobot-dev",
      cwd: __dirname,
      script: process.env.NANOBOT_PYTHON || "python3",
      args: "-m uvicorn nanobot.main:app --host 0.0.0.0 --port 8766",
      interpreter: "none",
      autorestart: true,
      watch: false,
      time: true,
      max_memory_restart: "512M",
      env: {
        PYTHONUNBUFFERED: "1",
        PYTHONPATH: `${__dirname}/nanobot`,
        NANOBOT_PORT: process.env.DEV_NANOBOT_PORT || "8766",
        NANOBOT_BACKEND_URL: process.env.DEV_NANOBOT_BACKEND_URL || "http://127.0.0.1:8011",
      },
    },
  ],
};
