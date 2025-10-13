import { app } from './app';
import { env } from './config/env';
import { logger } from './shared/utils/logger';

const port = env.appPort;

app.listen(port, () => {
  logger.info(`Servidor monolítico escuchando en http://0.0.0.0:${port}`);
});
