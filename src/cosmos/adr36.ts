export function sortObjectByKey(obj: Record<string, any>): any {
  if (typeof obj !== "object" || obj === null) {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(sortObjectByKey);
  }
  const sortedKeys = Object.keys(obj).sort();
  const result: Record<string, any> = {};
  sortedKeys.forEach((key) => {
    result[key] = sortObjectByKey(obj[key]);
  });
  return result;
}

export function sortedJsonByKeyStringify(obj: Record<string, any>): string {
  return JSON.stringify(sortObjectByKey(obj));
}

export function escapeHTML(str: string): string {
  return str.replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");
}

export function serializeSignDoc(signDoc: any): Uint8Array {
  return Buffer.from(escapeHTML(sortedJsonByKeyStringify(signDoc)));
}

export function makeADR36AminoSignDoc(signer: string, data: string | Uint8Array) {
  if (typeof data === "string") {
    data = Buffer.from(data).toString("base64");
  } else {
    data = Buffer.from(data).toString("base64");
  }

  return {
    chain_id: "",
    account_number: "0",
    sequence: "0",
    fee: {
      gas: "0",
      amount: [],
    },
    msgs: [
      {
        type: "sign/MsgSignData",
        value: {
          signer,
          data,
        },
      },
    ],
    memo: "",
  };
}
