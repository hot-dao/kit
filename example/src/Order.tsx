import styled from "styled-components";
import { useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";

import { formatter } from "../../src/omni/token";
import { omni } from "../../src";

import { P } from "./uikit/text";
import otc, { OrderType } from "./otc";
import { wibe3 } from "./wibe3";

export const Order = ({ order, type }: { order: OrderType; type: "ask" | "bid" }) => {
  const [isSelected, setIsSelected] = useState(false);
  const [valueAmount, setAmount] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isSelected || isLoading) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (inputRef.current && !inputRef.current.contains(event.target as Node)) setIsSelected(false);
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isSelected, isLoading]);

  const srcToken = omni.omni(order.params.src_token);
  const amount = BigInt(order.maker_src_remaining);
  const price = formatter.formatAmount(order.params.price, 12);

  const handleBuy = async () => {
    try {
      setIsLoading(true);
      const wallet = wibe3.wallets.find((t) => t.omniAddress);
      if (!wallet) throw "";
      const maount = formatter.fromInput(valueAmount);
      await otc.fill(wallet, +maount, order.params);
      toast.success("GONKA bought successfully");
      setIsLoading(false);
    } catch (error) {
      console.error(error);
      toast.error("Failed to buy GONKA");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <OrderWrap key={order.params.salt} ref={inputRef}>
      <Row>
        <P>{order.params.receive_dst_to.msg}</P>
      </Row>
      <Row>
        <P>${formatter.amount(price)}</P>
      </Row>
      <Row>
        <P>
          {srcToken.readable(amount)} {srcToken.symbol}
        </P>
      </Row>
      <Row>
        <P>${srcToken.readable(amount, price)}</P>
      </Row>

      {!isSelected && (
        <Row style={{ justifyContent: "flex-end" }}>
          <BuyButton onClick={() => setIsSelected(true)} type={type}>
            {type === "ask" ? "Buy" : "Sell"}
          </BuyButton>
        </Row>
      )}

      {isSelected && (
        <EditAmount>
          <input //
            type="text"
            autoFocus
            value={formatter.fromInput(valueAmount)}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Enter amount"
          />

          <BuyButton onClick={handleBuy} type={type} disabled={isLoading}>
            {isLoading ? "Executing" : type === "ask" ? "Buy" : "Sell"}
          </BuyButton>
        </EditAmount>
      )}
    </OrderWrap>
  );
};

const EditAmount = styled.div`
  position: absolute;
  width: 100%;
  padding: 12px;
  box-shadow: 0px 4px 12px 0px rgba(0, 0, 0, 0.25);
  background: var(--surface-common-container--low, #262729);
  height: 54px;
  top: 55px;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: space-between;

  input {
    flex: 1;
    font-weight: bold;
    font-size: 24px;
    outline: none;
    height: 100%;
    border: none;
    padding: 12px;
    width: calc(50% - 50px);
    background: var(--surface-common-container--low, #262729);
  }
`;

export const OrderWrap = styled.div`
  position: relative;
  padding: 12px;
  background: var(--surface-common-container--low, #262729);
  display: grid;
  grid-template-columns: 2fr 2fr 2fr 2fr 1fr;
  margin-top: 1px;
  height: 54px;
  gap: 12px;
`;

const Row = styled.div`
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  display: flex;
  align-items: center;
`;

export const BuyButton = styled.button<{ type: "bid" | "ask" }>`
  display: flex;
  width: 80px;
  padding: 6px 12px;
  justify-content: center;
  align-items: center;
  gap: 4px;
  border-radius: 8px;
  background: ${(t) => (t.type !== "ask" ? "rgba(238, 85, 85, 0.10)" : "rgba(119, 199, 189, 0.1)")};
  color: ${(t) => (t.type !== "ask" ? "#EE5555" : "#1BC3A9")};
  cursor: pointer;
  outline: none;
  border: none;
  font-size: 16px;
  font-weight: bold;
`;
