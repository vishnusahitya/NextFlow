import crypto from "node:crypto";

export type TransloaditSignatureAlgorithm = "sha1" | "sha384";

export function signTransloaditParams(
  params: Record<string, unknown>,
  signatureAlgorithm?: TransloaditSignatureAlgorithm,
) {
  const secret =
    process.env.TRANSLOADIT_AUTH_SECRET ?? process.env.TRANSLOADIT_SECRET;
  const key = process.env.TRANSLOADIT_AUTH_KEY ?? process.env.TRANSLOADIT_KEY;
  if (!secret || !key) {
    throw new Error(
      "Missing Transloadit credentials. Set TRANSLOADIT_AUTH_KEY/TRANSLOADIT_AUTH_SECRET (or TRANSLOADIT_KEY/TRANSLOADIT_SECRET).",
    );
  }
  const algorithmFromEnv = (
    process.env.TRANSLOADIT_SIGNATURE_ALGORITHM ?? "sha384"
  ).toLowerCase();
  const algorithm =
    signatureAlgorithm ??
    (algorithmFromEnv === "sha1" ? "sha1" : "sha384");

  const payload = {
    ...params,
    auth: {
      key,
      expires: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    },
  };

  const paramsJson = JSON.stringify(payload);
  const signature =
    `${algorithm}:` +
    crypto.createHmac(algorithm, secret).update(paramsJson).digest("hex");

  return {
    params: paramsJson,
    signature,
    signatureAlgorithm: algorithm,
  };
}
