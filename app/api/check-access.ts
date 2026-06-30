import sql from "mssql";

// Vercel Node.js serverless function.
// All credentials come from Vercel environment variables — nothing from the client.
export default async function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const body: unknown = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  const email: string | undefined = (body as any)?.email;

  if (!email || typeof email !== "string") {
    return res.status(400).json({ error: "Missing email" });
  }

  const clientId     = process.env.SYNAPSE_CLIENT_ID;
  const tenantId     = process.env.SYNAPSE_TENANT_ID;
  const clientSecret = process.env.SYNAPSE_CLIENT_SECRET;
  const server       = process.env.SYNAPSE_SERVER;
  const database     = process.env.SYNAPSE_DATABASE;

  if (!clientId || !tenantId || !clientSecret || !server || !database) {
    console.error("check-access: missing env vars");
    return res.status(500).json({ error: "Server not fully configured" });
  }

  try {
    // 1. Get an AAD access token for Synapse via client-credentials flow.
    const tokenRes = await fetch(
      `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id:     clientId,
          client_secret: clientSecret,
          scope:         "https://database.windows.net/.default",
          grant_type:    "client_credentials",
        }),
      },
    );

    if (!tokenRes.ok) {
      const raw = await tokenRes.text();
      console.error("AAD token error:", raw);
      let detail = raw.slice(0, 300);
      try {
        const j = JSON.parse(raw);
        detail = j.error_description || j.error || detail;
      } catch {
        /* keep raw */
      }
      // Surface the AADSTS code so the cause is clear (bad secret, wrong
      // tenant, etc.). First line of error_description holds the AADSTS code.
      return res.status(401).json({
        error: "Azure authentication failed",
        detail: String(detail).split(/\r?\n/)[0],
      });
    }

    const { access_token } = (await tokenRes.json()) as { access_token: string };

    // 2. Connect to Synapse Dedicated SQL Pool with the AAD token.
    const pool = await sql.connect({
      server,
      database,
      options: { encrypt: true, trustServerCertificate: false },
      authentication: {
        type: "azure-active-directory-access-token",
        options: { token: access_token },
      },
    } as sql.config);

    // 3. Check if the email exists in the allowlist table.
    const result = await pool
      .request()
      .input("email", sql.NVarChar, email.toLowerCase().trim())
      .query(
        "SELECT COUNT(1) AS cnt FROM mini_mail.[user] WHERE LOWER(email) = @email",
      );

    await pool.close();

    const allowed: boolean = (result.recordset[0] as { cnt: number }).cnt > 0;
    return res.status(200).json({ allowed });

  } catch (err) {
    console.error("check-access error:", err);
    return res.status(500).json({
      error: "Access check failed",
      detail: err instanceof Error ? err.message : String(err),
    });
  }
}
