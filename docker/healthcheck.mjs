try {
  const response = await fetch("http://127.0.0.1:3000/login", {
    signal: AbortSignal.timeout(5000),
  });
  if (response.status !== 200) process.exitCode = 1;
} catch {
  process.exitCode = 1;
}
