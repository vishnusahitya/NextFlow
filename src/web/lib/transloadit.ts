import crypto from "node:crypto";

export function signTransloaditParams(params: Record<string, unknown>) {
  const secret = process.env.TRANSLOADIT_AUTH_SECRET;
  const key = process.env.TRANSLOADIT_AUTH_KEY;
  if (!secret || !key) {
    throw new Error("Missing Transloadit credentials");
  }

  const payload = {
    ...params,
    auth: {
      key,
      expires: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    },
  };

  const paramsJson = JSON.stringify(payload);
  const signature =
    "sha384:" +
    crypto.createHash("sha384").update(paramsJson + secret).digest("hex");

  return {
    params: paramsJson,
    signature,
  };
}
