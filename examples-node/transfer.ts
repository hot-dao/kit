import "dotenv/config";

import { base58 } from "@scure/base";
import { Recipient, tokens, OmniToken, Network } from "../src/core";
import { NearWallet } from "../src/near";

if (!process.env.ED25519_PRIVATE_KEY_BASE58) {
  throw new Error("ED25519_PRIVATE_KEY_BASE58 is not set in .env file");
}

if (!process.env.ED25519_NEAR_SIGNER_ID) {
  throw new Error("ED25519_SIGNER_ID is not set in .env file");
}

const PRIVATE_KEY = base58.decode(process.env.ED25519_PRIVATE_KEY_BASE58);
const SIGNER_ID = process.env.ED25519_NEAR_SIGNER_ID;

const main = async () => {
  const wallet = await NearWallet.fromPrivateKey(Buffer.from(PRIVATE_KEY), SIGNER_ID);

  const token = tokens.get(OmniToken.NEAR);
  const assets = await wallet.fetchBalance(Network.Omni, OmniToken.NEAR);
  console.log("NEAR balance:", token.float(assets[token.omniAddress]));

  const recipient = await Recipient.fromAddress(Network.Near, "azbang69.near");
  const hash = await wallet
    .intents()
    .transfer({
      recipient: recipient.omniAddress,
      token: OmniToken.NEAR,
      amount: 1n,
    })
    .execute();

  console.log("1 yoctoNEAR Transfer Hash:", `https://hotscan.org/transaction/${hash}`);
};

main().catch(console.error);
