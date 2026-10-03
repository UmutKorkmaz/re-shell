import { ApiRestClient } from '../../api/generated/api-rest/ts/client';
import { helper } from '@acme/api/dist/helper';

const client = new ApiRestClient({ baseUrl: process.env.API_URL ?? 'http://api:4000' });
console.log(client, helper);
