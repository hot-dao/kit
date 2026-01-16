import stellar from "./stellar";
import solana from "./solana";
import near from "./near";
import evm from "./evm";
import ton from "./ton";

export const defaultConnectors = [near(), evm(), solana(), ton(), stellar()];
