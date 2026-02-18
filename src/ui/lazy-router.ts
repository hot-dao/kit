type RouterModule = typeof import("./router");

let routerPromise: Promise<RouterModule> | null = null;

function getRouter(): Promise<RouterModule> {
  if (!routerPromise) routerPromise = import("./router");
  return routerPromise;
}

export const openPayment: RouterModule["openPayment"] = async (...args) => {
  const router = await getRouter();
  return router.openPayment(...args);
};

export const openLogoutPopup: RouterModule["openLogoutPopup"] = async (...args) => {
  const router = await getRouter();
  return router.openLogoutPopup(...args);
};

export const openBridge: RouterModule["openBridge"] = async (...args) => {
  const router = await getRouter();
  return router.openBridge(...args);
};

export const openAuthPopup: RouterModule["openAuthPopup"] = async (...args) => {
  const router = await getRouter();
  return router.openAuthPopup(...args);
};

export const openConnector: RouterModule["openConnector"] = async (...args) => {
  const router = await getRouter();
  return router.openConnector(...args);
};

export const openDepositFlow: RouterModule["openDepositFlow"] = async (...args) => {
  const router = await getRouter();
  return router.openDepositFlow(...args);
};

export const openConnectPrimaryWallet: RouterModule["openConnectPrimaryWallet"] = async (...args) => {
  const router = await getRouter();
  return router.openConnectPrimaryWallet(...args);
};

export const openProfile: RouterModule["openProfile"] = async (...args) => {
  const router = await getRouter();
  return router.openProfile(...args);
};

export const openSelectTokenPopup: RouterModule["openSelectTokenPopup"] = async (...args) => {
  const router = await getRouter();
  return router.openSelectTokenPopup(...args);
};

export const openWalletPicker: RouterModule["openWalletPicker"] = async (...args) => {
  const router = await getRouter();
  return router.openWalletPicker(...args);
};

export const openSelectSender: RouterModule["openSelectSender"] = async (...args) => {
  const router = await getRouter();
  return router.openSelectSender(...args);
};

export const openSelectRecipient: RouterModule["openSelectRecipient"] = async (...args) => {
  const router = await getRouter();
  return router.openSelectRecipient(...args);
};

export const openWCRequest: RouterModule["openWCRequest"] = async (...args) => {
  const router = await getRouter();
  return router.openWCRequest(...args);
};
