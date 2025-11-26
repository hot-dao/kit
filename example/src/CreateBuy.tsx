import { observer } from "mobx-react-lite";
import styled from "styled-components";
import { toast } from "react-toastify";
import { useState } from "react";

import { formatter } from "../../src/omni/token";
import otc from "./otc";
import { wibe3 } from "./wibe3";
import { OmniToken } from "../../src";

const CreateBuy = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [valueAmount, setAmount] = useState("");
  const [valuePrice, setPrice] = useState("");

  const amount = formatter.fromInput(valueAmount);
  const price = formatter.fromInput(valuePrice);

  const sell = async () => {
    try {
      setIsLoading(true);
      const wallet = wibe3.wallets.find((t) => t.omniAddress);
      if (!wallet) throw "";
      await otc.fund(wallet, OmniToken.USDT, OmniToken.JUNO, +amount, +price);
      toast.success("GONKA bought successfully");
      setIsLoading(false);
    } catch (error) {
      toast.error("Failed to buy GONKA");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <CreateCard>
      <input type="text" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Sell 1 USDT" />
      <input type="text" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="to buy 1 GONKA" />
      <Button onClick={sell} disabled={isLoading}>
        {isLoading ? "Executing" : "Buy GONKA"}
      </Button>
    </CreateCard>
  );
};

const Button = styled.button`
  border-radius: 8px;
  background: linear-gradient(0deg, #292929 0%, #292929 100%), linear-gradient(44deg, #1b1b1b 50.48%, #303030 103.9%), linear-gradient(87deg, #fff 4.14%, #c3c3c3 54.6%, #fff 100%);
  display: flex;
  padding: 8px 16px 8px 24px;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  outline: none;
  border: none;
  color: #fff;
  font-size: 16px;
  font-weight: bold;
`;

export const CreateCard = styled.div`
  display: flex;
  background: var(--surface-common-container--low, #262729);
  align-items: center;
  height: 56px;
  width: 100%;

  input {
    font-weight: bold;
    font-size: 24px;
    outline: none;
    height: 100%;
    border: none;
    padding: 12px;
    width: calc(50% - 50px);
  }

  button {
    display: flex;
    justify-content: center;
    align-items: center;
    width: 100px;
  }
`;

export default observer(CreateBuy);
