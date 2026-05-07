import jwt from "jsonwebtoken";

export default function handler(req, res) {
  const privateKey = process.env.APPLE_PRIVATE_KEY.replace(/\\n/g, "\n");
  const teamId = process.env.APPLE_TEAM_ID;
  const keyId = process.env.APPLE_KEY_ID;

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
}
