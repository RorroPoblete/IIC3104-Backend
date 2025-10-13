import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env';
import { errorHandler } from './shared/middleware/errorHandler';
import { codificationRouter } from './modules/codification/routes/import';
import { systemRouter } from './modules/system/routes/system';

const app = express();

const allowedOrigins = env.corsOrigins.length ? env.corsOrigins : true;

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
app.use('/', systemRouter);

app.use(errorHandler);

export { app };
