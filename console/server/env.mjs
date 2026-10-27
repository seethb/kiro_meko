// Load .env when there is one. Values already in the environment win.
try {
  process.loadEnvFile(new URL("../.env", import.meta.url).pathname);
} catch {}
