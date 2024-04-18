export default interface IFundSettings {
  [key: string]: any;
  depositFee?: string;
  withdrawFee?: string;
  performanceFee?: string;
  managementFee?: string;
  // TODO Here we have a typo, we should fix this in the original interface: IGovernableFundStorage
  performaceHurdleRateBps?: string;
  baseToken: string;
  safe?: string;
  isExternalGovTokenInUse?: boolean;
  isWhitelistedDeposits?: boolean;
  allowedDepositAddrs?: string[];
  allowedManagers?: string[];
  governanceToken?: string;
  governor?: string;
  fundAddress: string;
  fundName: string;
  fundSymbol: string;
}
