import HOT from "../hot-wallet/iframe";

if (HOT.isInjected) {
  // @ts-expect-error: hotWallet is not defined
  window.hotWallet = {
    tonconnect: {
      deviceInfo: {
        appName: "hot",
        appVersion: "1",
        maxProtocolVersion: 2,
        platform: "ios",
        features: [
          "SendTransaction",
          {
            name: "SendTransaction",
            maxMessages: 255,
            extraCurrencySupported: false,
          },
          {
            name: "SignData",
            types: ["text", "binary", "cell"],
          },
        ],
      },

      walletInfo: {
        name: "hotWallet",
        image: "https://storage.herewallet.app/logo.png",
        about_url: "https://hot-labs.org",
      },

      protocolVersion: 2,
      isWalletBrowser: true,

      connect: (_: number, request: any) => {
        return HOT.request("ton:connect", request);
      },

      restoreConnection: () => {
        return HOT.request("ton:restoreConnection", {});
      },

      disconnect: () => {
        return HOT.request("ton:disconnect", {});
      },

      send: async (request: any) => {
        return HOT.request("ton:send", request);
      },

      listen: () => {
        return function () {};
      },
    },
  };
}
