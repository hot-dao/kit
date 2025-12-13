import HOT from "../hot-wallet/iframe";

class HotEvmProvider {
  _events = new Map<string, Set<any>>();
  isConnected = () => true;
  isHotWallet = true;
  isMetaMask = true;

  request = (request: any) => HOT.request("ethereum", request);
  removeListener() {}
  on() {}
}

function announceProvider(provider: HotEvmProvider) {
  // @ts-expect-error: window.ethereum is not typed
  window.ethereum = undefined;
  // @ts-expect-error: window.ethereum is not typed
  window.ethereum = provider;
  window?.dispatchEvent(
    new CustomEvent("eip6963:announceProvider", {
      detail: Object.freeze({
        provider: provider,
        info: {
          icon: "https://storage.herewallet.app/logo.png",
          rdns: "org.hot-labs",
          uuid: "cc8e962c-1f42-425c-8845-e8bd2e136fff",
          name: "HOT Wallet",
        },
      }),
    })
  );
}

if (HOT.isInjected) {
  const hotProvider = new HotEvmProvider();
  window.addEventListener("eip6963:requestProvider", () => announceProvider(hotProvider));
  announceProvider(hotProvider);
}
