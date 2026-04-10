(async () => {
    const password = "Test1234";
    const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
    const randId = () =>
      Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
    for (let i = 0; i < 100; i++) {
      const email = `newuser${randId()}@example.com`;
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          confirmPassword: password,
        }),
      });
      const data = await res.json();
      console.log(i + 1, email, res.status, data);
      if (!res.ok) break;
      const out = await fetch("/api/auth/logout", { method: "POST" });
      const outData = await out.json();
      console.log("logout", out.status, outData);
    }
  })();
