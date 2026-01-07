import styled from "styled-components";

export const PSmall = styled.p`
  color: var(--text-text-secondary, #bfbfbf);
  font-family: var(--font-family-text, "Golos Text");
  font-size: var(--P-Small-font-size, 14px);
  line-height: var(--P-Small-line-height, 20px); /* 142.857% */
  letter-spacing: -0.14px;
  font-style: normal;
  font-weight: 400;
  margin: 0;
`;

export const PMedium = styled.p`
  color: var(--text-text-primary, #fff);
  font-family: var(--font-family-text, "Golos Text");
  font-size: var(--P-Default-font-size, 16px);
  line-height: var(--P-Default-line-height, 22px); /* 137.5% */
  letter-spacing: -0.16px;
  font-style: normal;
  margin: 0;
`;

export const PLarge = styled.p`
  color: var(--text-text-primary, #fff);
  font-family: var(--font-family-text, "Golos Text");
  font-size: var(--P-Large-font-size, 18px);
  line-height: var(--P-Large-line-height, 24px); /* 133.333% */
  font-style: normal;
  font-weight: 500;
  letter-spacing: -0.18px;
  margin: 0;
`;

export const PTiny = styled.p`
  color: var(--text-text-primary, #fff);
  font-family: var(--font-family-text, "Golos Text");
  font-size: var(--P-Tiny-font-size, 12px);
  line-height: var(--P-Tiny-line-height, 16px);
  letter-spacing: -0.12px;
  font-style: normal;
  font-weight: 400;
  margin: 0;
`;

export const H5 = styled.h5`
  color: var(--text-text-tertiary, #fff);
  font-family: var(--font-family-headings, "Golos Text");
  font-size: var(--h5-font-size, 24px);
  line-height: var(--h5-line-height, 32px);
  font-style: normal;
  font-weight: 500;
  margin: 0;
`;

export const H4 = styled.h4`
  color: var(--text-text-primary, #fff);
  font-family: var(--font-family-headings, "Golos Text");
  font-size: var(--h4-font-size, 32px);
  line-height: var(--h4-line-height, 44px);
  font-style: normal;
  font-weight: 600;
  margin: 0;
`;
