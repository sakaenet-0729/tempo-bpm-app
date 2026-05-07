import jwt from "jsonwebtoken";

export default function handler(req, res) {
  try {
    const privateKeyRaw = process.env.APPLE_PRIVATE_KEY;
    const teamId = process.env.APPLE_TEAM_ID;
    const keyId = process.env.APPLE_KEY_ID;

    if (!privateKeyRaw || !teamId || !keyId) {
      return res.status(500).json({
        error: "Missing env vars",
        hasKey: !!privateKeyRaw,
        hasTeam: !!teamId,
        hasKeyId: !!keyId,
      });
    }

    const privateKey = privateKeyRaw.replace(/\\n/g, "\n");

    const token = jwt.sign({}, privateKey, {
      algorithm: "ES256",
      expiresIn: "180d",
      issuer: teamId,
      header: {
        alg: "ES256",
        kid: keyId,
      },
    });

    res.status(200).json({ token });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
