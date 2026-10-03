import express from 'express';
import { BillingRestClient } from '../../billing/generated/billing-rest/ts/client';

const billing = new BillingRestClient({ baseUrl: process.env.BILLING_URL! });
const analytics = process.env.ANALYTICS_URL;
const app = express();
app.get('/health', (_req, res) => res.json({ ok: true, billing: !!billing, analytics }));
app.listen(4000);
