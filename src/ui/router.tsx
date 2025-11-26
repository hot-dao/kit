import { HotConnector } from "../HotConnector";
import { OmniConnector } from "../omni/OmniConnector";
import { BridgeReview } from "../omni";
import { Token } from "../omni/token";
import { OmniWallet, WalletType } from "../omni/OmniWallet";

import { present } from "./Popup";
import Payment from "./payment/Payment";
import LogoutPopup from "./connect/LogoutPopup";
import Bridge from "./payment/Bridge";
import Connector from "./connect/ConnectWallet";
import Profile from "./payment/Profile";
import SelectTokenPopup from "./payment/SelectToken";
import WalletPicker from "./connect/WalletPicker";
import SelectWallet from "./payment/SelectWallet";
import { BridgeProps } from "./payment/Bridge";

export const openPayment = (connector: HotConnector, token: Token, amount: bigint, receiver: string) => {
  return present<BridgeReview>((resolve, reject) => {
    return <Payment onReject={reject} onSuccess={resolve} connector={connector} token={token} amount={amount} receiver={receiver} />;
  });
};

export const openLogoutPopup = (connector: OmniConnector): Promise<void> => {
  return present<void>((resolve, reject) => {
    return <LogoutPopup connector={connector} onApprove={() => resolve()} onReject={() => reject(new Error("User rejected"))} />;
  });
};

export const openBridge = (hot: HotConnector, setup?: BridgeProps["setup"]) => {
  return present<BridgeReview>((resolve, reject) => {
    return <Bridge onClose={reject} hot={hot} setup={setup} />;
  });
};

export const openConnector = (hot: HotConnector, connector?: OmniConnector) => {
  return present<void>((resolve, reject) => {
    return <Connector hot={hot} onClose={() => reject(new Error("User rejected"))} />;
  });
};

export const openProfile = (hot: HotConnector) => {
  return present<void>((resolve, reject) => {
    return <Profile hot={hot} onClose={() => resolve()} />;
  });
};

export const openSelectTokenPopup = ({ hot, initialChain, onSelect }: { hot: HotConnector; initialChain?: number; onSelect: (token: Token, wallet?: OmniWallet) => void }) => {
  return present<Token | null>((resolve, reject) => {
    return <SelectTokenPopup hot={hot} initialChain={initialChain} onClose={reject} onSelect={(t, w) => (onSelect(t, w), reject())} />;
  });
};

export const openWalletPicker = (connector: OmniConnector) => {
  return present<void>((resolve, reject) => {
    return <WalletPicker initialConnector={connector} onClose={reject} />;
  });
};

export const openSelectWallet = (hot: HotConnector, isRecipient: boolean, type: WalletType, onSelect: (wallet?: OmniWallet) => void) => {
  return present<void>((resolve, reject) => {
    return <SelectWallet isRecipient={isRecipient} hot={hot} type={type} onSelect={onSelect} onClose={reject} />;
  });
};
