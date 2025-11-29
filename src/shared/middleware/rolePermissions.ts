import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export type Role = 'Administrador' | 'Analista' | 'Codificador' | 'Finanzas';

export type Permission = 
  | 'codification.upload'
  | 'codification.edit.at'
  | 'codification.edit.finance'
  | 'codification.view'
  | 'codification.download'
  | 'pricing.modify'
  | 'ajustes.modify';

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  Administrador: [
    'codification.upload',
    'codification.edit.at',
    'codification.edit.finance',
    'codification.view',
    'codification.download',
    'pricing.modify',
    'ajustes.modify',
  ],
  Codificador: [
    'codification.upload',
    'codification.edit.at',
    'codification.view',
    'codification.download',
  ],
  Finanzas: [
    'codification.edit.finance',
    'codification.view',
    'codification.download',
  ],
  Analista: [
    'codification.view',
    'codification.download',
  ],
};

export const requirePermission = (permission: Permission) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const userRole = req.authUser?.role as Role | undefined;

    if (!userRole) {
      logger.warn('Intento de acceso sin rol de usuario', { path: req.path });
      return res.status(403).json({ message: 'No se pudo determinar el rol del usuario' });
    }

    const userPermissions = ROLE_PERMISSIONS[userRole] || [];
    
    if (!userPermissions.includes(permission)) {
      logger.warn('Acceso denegado por falta de permisos', { 
        userRole, 
        requiredPermission: permission,
        path: req.path 
      });
      return res.status(403).json({ 
        message: `No tienes permisos para realizar esta acción. Se requiere: ${permission}` 
      });
    }

    return next();
  };
};

export const requireAnyRole = (...roles: Role[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const userRole = req.authUser?.role as Role | undefined;

    if (!userRole) {
      logger.warn('Intento de acceso sin rol de usuario', { path: req.path });
      return res.status(403).json({ message: 'No se pudo determinar el rol del usuario' });
    }

    if (!roles.includes(userRole)) {
      logger.warn('Acceso denegado por rol incorrecto', { 
        userRole, 
        requiredRoles: roles,
        path: req.path 
      });
      return res.status(403).json({ 
        message: `No tienes permisos para acceder a este recurso. Roles permitidos: ${roles.join(', ')}` 
      });
    }

    return next();
  };
};

// Campos editables por rol
export const CODIFICADOR_EDITABLE_FIELDS = [
  'proced01Principal',
  'conjuntoProcedimientosSecundarios',
  'diagnosticoPrincipal',
  'conjuntoDx',
  'especialidadMedica',
  'medicoEgreso',
  'especialidadEgreso',
  'servicioIngresoDesc',
  'servicioEgresoDesc',
  'motivoEgreso',
  'fechaIngresoCompleta',
  'fechaCompleta',
  'estanciaEpisodio',
  'estanciaRealEpisodio',
  'horasEstancia',
  'facturacionTotal',
  'emNorma',
  'estanciasNorma',
  'casosNorma',
];

export const FINANZAS_EDITABLE_FIELDS = [
  'validacion',
  'estadoRN',
  'diasDemora',
];

export const ADMIN_EDITABLE_FIELDS = [
  // Administrador puede editar todos los campos
];

export const getEditableFieldsForRole = (role: Role): string[] => {
  switch (role) {
    case 'Administrador':
      return [...CODIFICADOR_EDITABLE_FIELDS, ...FINANZAS_EDITABLE_FIELDS, ...ADMIN_EDITABLE_FIELDS];
    case 'Codificador':
      return CODIFICADOR_EDITABLE_FIELDS;
    case 'Finanzas':
      return FINANZAS_EDITABLE_FIELDS;
    default:
      return [];
  }
};

