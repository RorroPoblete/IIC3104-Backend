import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env';
import { errorHandler } from './shared/middleware/errorHandler';
import { codificationRouter } from './modules/codification/routes/import';
import { systemRouter } from './modules/system/routes/system';
import { normaMinsalRouter } from './modules/normaminsal/routes/normaminsal';
import { pricingRouter } from './modules/pricing/routes/pricing';
import { calculoRouter } from './modules/calculo/routes/calculo';
import { ajustesRouter } from './modules/ajustes/routes/ajustes';
import { auditRouter } from './modules/system/routes/audit';

const app = express();

const allowedOrigins = env.corsOrigins.length
  ? env.corsOrigins
  : env.isProduction
    ? ['https://iic3104-frontend.onrender.com']
    : true;

app.use(helmet());
app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  }),
);
app.use(morgan('combined'));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

app.use('/api/codification', codificationRouter);
app.use('/api/normaminsal', normaMinsalRouter);
app.use('/api/pricing', pricingRouter);
app.use('/api/calculo', calculoRouter);
app.use('/api/ajustes', ajustesRouter);
app.use('/api/audit', auditRouter);
app.use('/', systemRouter);

app.use(errorHandler);

export { app };
