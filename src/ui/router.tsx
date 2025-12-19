import { HotConnector } from "../HotConnector";
import { OmniConnector } from "../OmniConnector";
import { OmniWallet } from "../OmniWallet";

import { BridgeReview } from "../exchange";
import { OmniToken, WalletType } from "../core/chains";
import { Recipient } from "../core/recipient";
import { Intents } from "../core/Intents";
import { Token } from "../core/token";

import { present } from "./Popup";
import { SelectTokenPopup } from "./payment/SelectToken";
import { SelectRecipient } from "./payment/SelectRecipient";
import { SelectSender } from "./payment/SelectSender";
import { BridgeProps } from "./payment/Bridge";
import { Payment } from "./payment/Payment";
import { Profile } from "./payment/Profile";
import { Bridge } from "./payment/Bridge";

import ConnectPrimaryWallet from "./connect/PrimaryWallet";
import { LogoutPopup } from "./connect/LogoutPopup";
import { WalletPicker } from "./connect/WalletPicker";
import { Connector } from "./connect/ConnectWallet";
import { WCRequest } from "./connect/WCRequest";
import Toast from "./Toast";

export const openPayment = (
  connector: HotConnector,
  { intents, title, allowedTokens, prepaidAmount, payableToken, needAmount }: { intents: Intents; title?: string; allowedTokens?: string[]; prepaidAmount: bigint; payableToken: Token; needAmount: bigint }
) => {
  return new Promise<{ depositQoute: BridgeReview | "direct"; processing?: () => Promise<BridgeReview> }>((resolve, reject) => {
    present((close) => (
      <Payment //
        onReject={() => (close(), reject(new Error("User rejected")))}
        onConfirm={(args) => (close(), resolve(args))}
        prepaidAmount={prepaidAmount}
        allowedTokens={allowedTokens}
        payableToken={payableToken}
        needAmount={needAmount}
        connector={connector}
        intents={intents}
        title={title}
      />
    ));
  });
};

export const openLogoutPopup = (connector: OmniConnector) => {
  return new Promise<void>((resolve, reject) => {
    present((close) => {
      return (
        <LogoutPopup //
          connector={connector}
          onApprove={() => (close(), resolve())}
          onReject={() => (close(), reject(new Error("User rejected")))}
        />
      );
    });
  });
};

export const openBridge = (hot: HotConnector, setup?: BridgeProps["setup"]) => {
  return new Promise<BridgeReview>((resolve, reject) => {
    present((close) => (
      <Bridge //
        hot={hot}
        setup={setup}
        onProcess={resolve}
        onClose={() => (close(), reject(new Error("User rejected")))}
      />
    ));
  });
};

export const openConnector = (hot: HotConnector) => {
  present((close) => <Connector hot={hot} onClose={close} />);
};

export const openConnectPrimaryWallet = (hot: HotConnector) => {
  return new Promise<void>((resolve) => {
    present((close) => <ConnectPrimaryWallet hot={hot} onClose={() => (close(), resolve())} />);
  });
};

export const openProfile = (hot: HotConnector) => {
  present((close) => <Profile hot={hot} onClose={close} />);
};

export const openSelectTokenPopup = ({ hot, initialChain, onSelect }: { hot: HotConnector; initialChain?: number; onSelect: (token: Token, wallet?: OmniWallet) => void }) => {
  present((close) => <SelectTokenPopup hot={hot} initialChain={initialChain} onClose={close} onSelect={(t, w) => (onSelect(t, w), close())} />);
};

export const openWalletPicker = (connector: OmniConnector, onSelect?: (wallet: OmniWallet) => void) => {
  present((close) => <WalletPicker initialConnector={connector} onSelect={onSelect} onClose={close} />);
};

export const openSelectSender = (props: { hot: HotConnector; type: WalletType; onSelect: (wallet?: OmniWallet | "qr") => void }) => {
  present((close) => <SelectSender {...props} onClose={close} />);
};

export const openSelectRecipient = (props: { hot: HotConnector; recipient?: Recipient; type: WalletType; onSelect: (wallet?: Recipient) => void }) => {
  present((close) => <SelectRecipient {...props} onClose={close} />);
};

export const openWCRequest = <T,>(args: { task: () => Promise<T>; deeplink?: string; name: string; icon: string; request: any }): Promise<T> => {
  const taskPromise = args.task();
  present((close) => <WCRequest deeplink={args.deeplink} name={args.name} icon={args.icon} onClose={close} task={taskPromise} />);
  return taskPromise;
};

export const openToast = (message: string) => {
  return present(() => <Toast message={message} />);
};
