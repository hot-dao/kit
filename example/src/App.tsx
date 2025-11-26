import styled from "styled-components";
import { observer } from "mobx-react-lite";

import { wibe3 } from "./wibe3";
import { Order } from "./Order";
import otc from "./otc";
import { H3, P, PSmall } from "./uikit/text";
import CreateBuy from "./CreateBuy";
import CreateSell from "./CreateSell";
import { formatter } from "../../src/omni/token";

const App = () => {
  const hexBalance = wibe3.tokens.reduce((acc, token) => {
    return wibe3.wallets.reduce((acc, wallet) => {
      if (token.chain !== -4) return acc;
      return acc + token.float(wibe3.balance(wallet, token)) * token.usd;
    }, acc);
  }, 0);

  const onchainBalance = wibe3.tokens.reduce((acc, token) => {
    return wibe3.wallets.reduce((acc, wallet) => {
      if (token.chain === -4) return acc;
      return acc + token.float(wibe3.balance(wallet, token)) * token.usd;
    }, acc);
  }, 0);

  return (
    <Root>
      <Header>
        <img src="images/logo.svg" alt="HEX" height={40} />

        <Button style={{ marginLeft: "auto" }}>
          <P style={{ color: "#bcbcbc" }}>Onchain balance</P>
          <P style={{ color: "#fff" }}>${formatter.amount(onchainBalance, 2)}</P>
        </Button>

        <Button>
          <P style={{ color: "#bcbcbc" }}>HEX balance</P>
          <P style={{ color: "#fff" }}>${formatter.amount(hexBalance, 2)}</P>
        </Button>

        <Button onClick={() => wibe3.connect()}>{wibe3.wallets.length > 0 ? wibe3.wallets[0].address : "Connect wallet"}</Button>
      </Header>

      <Main>
        <Content>
          <div style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <H3>
              GONKA AI <span style={{ fontSize: 14, color: "#bcbcbc" }}>OTC Market</span>
            </H3>
          </div>
        </Content>

        <Content style={{ marginTop: 32 }}>
          <div style={{ flex: 1, width: 600 }}>
            <CreateSell />

            <TableHeader>
              <PSmall>Seller</PSmall>
              <PSmall>Price</PSmall>
              <PSmall>Amount</PSmall>
              <PSmall>Amount (USD)</PSmall>
              <div />
            </TableHeader>

            {otc.orders.ask.map((order) => (
              <Order key={order.params.salt} order={order} type="ask" />
            ))}
          </div>

          <div style={{ flex: 1, width: 600 }}>
            <CreateBuy />

            <TableHeader>
              <PSmall>Buyer</PSmall>
              <PSmall>Price</PSmall>
              <PSmall>Amount</PSmall>
              <PSmall>Amount (USD)</PSmall>
              <div />
            </TableHeader>

            {otc.orders.bid.map((order) => (
              <Order key={order.params.salt} order={order} type="bid" />
            ))}
          </div>
        </Content>
      </Main>
    </Root>
  );
};

const Root = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: var(--surface-background-container--low, #141518);
  width: 100vw;
  height: 100vh;
`;

const Header = styled.div`
  width: 100%;
  height: 70px;
  padding: 12px 24px;
  display: flex;
  justify-content: space-between;
  border-bottom: 1px solid var(--border-low, rgba(255, 255, 255, 0.1));
  background: var(--surface-background-container--low, #141518);
  align-items: center;
  flex-shrink: 0;
  gap: 12px;
`;

const Main = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
`;

const Content = styled.div`
  display: flex;
  max-width: 1200px;
  width: 100%;
  gap: 24px;
`;

const Button = styled.button`
  border-radius: 8px;
  background: linear-gradient(0deg, #292929 0%, #292929 100%), linear-gradient(44deg, #1b1b1b 50.48%, #303030 103.9%), linear-gradient(87deg, #fff 4.14%, #c3c3c3 54.6%, #fff 100%);
  display: flex;
  padding: 8px 12px;
  height: 40px;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  outline: none;
  border: none;
  color: #fff;
  font-size: 16px;
  font-weight: bold;
`;

export const TableHeader = styled.div`
  display: grid;
  width: 100%;
  margin-top: 16px;
  background: var(--surface-common-container--low, #212125);
  grid-template-columns: 2fr 2fr 2fr 2fr 1fr;
  padding: 12px;
  gap: 12px;
`;

export default observer(App);
