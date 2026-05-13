-- wcreation | 0002 — Tipos enumerados
CREATE TYPE wcreation.estado_dispositivo AS ENUM (
  'provisionado',
  'activo',
  'inactivo',
  'baja'
);

CREATE TYPE wcreation.user_device_permiso AS ENUM (
  'ver',
  'configurar'
);

CREATE TYPE wcreation.notification_canal AS ENUM (
  'email',
  'push',
  'telegram'
);
