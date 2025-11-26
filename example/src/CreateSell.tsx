import { observer } from "mobx-react-lite";
import styled from "styled-components";
import { useState } from "react";
import { toast } from "react-toastify";

import { OmniToken } from "../../src";
import { formatter } from "../../src/omni/token";

import { CreateCard } from "./CreateBuy";
import { wibe3 } from "./wibe3";
import otc from "./otc";

const CreateSell = () => {
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
      await otc.fund(wallet, OmniToken.JUNO, OmniToken.USDT, +amount, +price);
      toast.success("GONKA sold successfully");
      setIsLoading(false);
    } catch (error) {
      toast.error("Failed to sell GONKA");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <CreateCard>
      <input type="text" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Sell 1 GONKA" />
      <input type="text" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="to buy 1 USDT" />
      <Button onClick={sell} disabled={isLoading}>
        {isLoading ? "Executing" : "Sell GONKA"}
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

export default observer(CreateSell);
