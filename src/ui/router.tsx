import { HotKit } from "../HotKit";
import { OmniConnector } from "../core/OmniConnector";
import { OmniWallet } from "../core/OmniWallet";

import { BridgeReview } from "../core/exchange";
import { BridgePending } from "../core/pendings";
import { WalletType } from "../core/chains";
import { Recipient } from "../core/recipient";
import { Intents } from "../core/Intents";
import { Token } from "../core/token";

import { present } from "./Popup";
import { SelectTokenPopup } from "./bridge/SelectToken";
import { SelectRecipient } from "./bridge/SelectRecipient";
import { SelectSender } from "./bridge/SelectSender";
import { BridgeProps } from "./bridge/Bridge";
import { Payment } from "./profile/Payment";
import { Profile } from "./profile/Profile";
import { Bridge } from "./bridge/Bridge";

import ConnectPrimaryWallet from "./connect/PrimaryWallet";
import { LogoutPopup } from "./connect/LogoutPopup";
import { WalletPicker } from "./connect/WalletPicker";
import { Connector } from "./connect/ConnectWallet";
import { WCRequest } from "./connect/WCRequest";
import { DepositFlow } from "./profile/DepositFlow";
import { AuthPopup } from "./connect/AuthPopup";

export const openPayment = (
  kit: HotKit,
  {
    intents,
    title,
    excludedTokens,
    allowedTokens,
    prepaidAmount,
    payableToken,
    needAmount,
    onConfirm,
  }: {
    intents: Intents;
    title?: string;
    allowedTokens?: string[];
    excludedTokens?: string[];
    prepaidAmount: bigint;
    payableToken: Token;
    needAmount: bigint;
    onConfirm: (pending?: BridgePending) => Promise<void>;
  }
) => {
  return new Promise<void>((resolve, reject) => {
    present((close) => (
      <Payment //
        title={title}
        intents={intents}
        kit={kit}
        needAmount={needAmount}
        prepaidAmount={prepaidAmount}
        allowedTokens={allowedTokens}
        payableToken={payableToken}
        excludedTokens={excludedTokens}
        close={() => (close(), resolve())}
        onReject={() => (close(), reject(new Error("User rejected")))}
        onConfirm={onConfirm}
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

export const openBridge = (kit: HotKit, setup?: BridgeProps["setup"]) => {
  return new Promise<BridgeReview>((resolve, reject) => {
    present((close) => (
      <Bridge //
        kit={kit}
        setup={setup}
        onProcess={resolve}
        onClose={() => (close(), reject(new Error("User rejected")))}
      />
    ));
  });
};

export const openAuthPopup = <T,>(wallet: OmniWallet, then: () => Promise<T>) => {
  return new Promise<T>((resolve, reject) => {
    present((close) => {
      return (
        <AuthPopup
          wallet={wallet}
          onReject={() => (close(), reject())}
          onApprove={async () => {
            try {
              const result = await then();
              resolve(result);
            } catch (e) {
              reject(e);
            } finally {
              close();
            }
          }}
        />
      );
    });
  });
};

export const openConnector = async (kit: HotKit) => {
  return new Promise<OmniWallet>((resolve, reject) => {
    present((close) => (
      <Connector
        kit={kit}
        onClose={(wallet) => {
          if (wallet) resolve(wallet);
          else reject(new Error("User rejected"));
          close();
        }}
      />
    ));
  });
};

export const openDepositFlow = (kit: HotKit, token?: Token) => {
  present((close) => <DepositFlow kit={kit} initialToken={token} onClose={close} />);
};

export const openConnectPrimaryWallet = (kit: HotKit) => {
  return new Promise<void>((resolve) => {
    present((close) => <ConnectPrimaryWallet kit={kit} onClose={() => (close(), resolve())} />);
  });
};

export const openProfile = (kit: HotKit) => {
  present((close) => <Profile kit={kit} onClose={close} />);
};

export const openSelectTokenPopup = ({ kit, disableChains, initialChain, onSelect }: { kit: HotKit; disableChains?: number[]; initialChain?: number; onSelect: (token: Token, wallet?: OmniWallet) => void }) => {
  present((close) => <SelectTokenPopup kit={kit} disableChains={disableChains} initialChain={initialChain} onClose={close} onSelect={(t, w) => (onSelect(t, w), close())} />);
};

export const openWalletPicker = (connector: OmniConnector, onSelect?: (wallet: OmniWallet) => void) => {
  return new Promise<OmniWallet>((resolve, reject) => {
    present((close) => (
      <WalletPicker //
        initialConnector={connector}
        onSelect={(w) => (onSelect?.(w), resolve(w))}
        onClose={(error) => (close(), reject(error ?? new Error("User rejected")))}
      />
    ));
  });
};

export const openSelectSender = (props: { kit: HotKit; type: WalletType; disableQR?: boolean; onSelect: (wallet?: OmniWallet | "qr") => void }) => {
  present((close) => <SelectSender {...props} onClose={close} />);
};

export const openSelectRecipient = (props: { kit: HotKit; recipient?: Recipient; chain: number; onSelect: (wallet?: Recipient) => void }) => {
  present((close) => <SelectRecipient {...props} onClose={close} />);
};

export const openWCRequest = <T,>(args: { task: () => Promise<T>; deeplink?: string; name: string; icon: string; request: any }): Promise<T> => {
  const taskPromise = args.task();
  present((close) => <WCRequest deeplink={args.deeplink} name={args.name} icon={args.icon} onClose={close} task={taskPromise} />);
  return taskPromise;
};
