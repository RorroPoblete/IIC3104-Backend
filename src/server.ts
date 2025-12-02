import { app } from './app';
import { env } from './config/env';
import { ensureDefaultUsers } from './shared/bootstrap/seedUsers';
import { logger } from './shared/utils/logger';

const port = env.appPort;

const startServer = async () => {
  try {
    // Log de configuración de Auth0 al iniciar
    logger.info('Configuración de Auth0 al iniciar', {
      hasDomain: !!env.auth0Domain,
      hasAudience: !!env.auth0Audience,
      hasClientId: !!env.auth0ClientId,
      domain: env.auth0Domain ? `${env.auth0Domain.substring(0, 10)}...` : 'no configurado',
    });

    await ensureDefaultUsers();

    app.listen(port, () => {
      logger.info(`Servidor monolítico escuchando en http://0.0.0.0:${port}`);
    });
  } catch (error) {
    logger.error('Error iniciando el servidor', { error });
    process.exit(1);
  }
};

startServer();
