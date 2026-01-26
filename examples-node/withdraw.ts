import "dotenv/config";

import { base58 } from "@scure/base";
import { Recipient, WalletType, tokens, OmniToken, Network, Exchange } from "../src/core";
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
  const exchange = new Exchange();
  const wallet = await NearWallet.fromPrivateKey(Buffer.from(PRIVATE_KEY), SIGNER_ID);
  const recipient = await Recipient.fromAddress(WalletType.Tron, "TTBMJ2ohKYgFon6owqM4nxNSUg1JNAa3Zm");

  const omniUSDT = tokens.get(OmniToken.USDT);
  const realTRONUSDT = tokens.get("TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t", Network.Tron);

  const review = await exchange.reviewSwap({
    sender: wallet,
    recipient: recipient,
    refund: wallet, // if bridge failed, the refund will be sent to this wallet

    from: omniUSDT, // OMNI TOKEN
    to: realTRONUSDT, // TRON TOKEN

    amount: omniUSDT.int(10),
    type: "exactIn",

    slippage: 0.01, // 1% slippage
    logger: console,
  });

  console.log("From", review.from.float(review.amountIn), review.from.symbol);
  console.log("To", review.to.float(review.amountOut), review.to.symbol);

  const { processing } = await exchange.makeSwap(review);

  // money sent, but not confirmed yet, so we need to wait for processing
  const resultReview = await processing?.();

  // money received!
  console.log(resultReview);
};

main().catch(console.error);
