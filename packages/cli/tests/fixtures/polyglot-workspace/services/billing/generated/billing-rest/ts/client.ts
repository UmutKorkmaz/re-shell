export interface BillingRestClientOptions {
  baseUrl: string;
}

/** Typed fetch client for the Billing REST contract. */
export class BillingRestClient {
  constructor(private readonly options: BillingRestClientOptions) {}
}

export default BillingRestClient;
