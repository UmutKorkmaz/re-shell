export interface ApiRestClientOptions {
  baseUrl: string;
}

/** Typed fetch client for the Api REST contract. */
export class ApiRestClient {
  constructor(private readonly options: ApiRestClientOptions) {}
}

export default ApiRestClient;
