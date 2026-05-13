-- wcreation | 0004 — Accesos, umbrales, QR público, notificaciones
CREATE TABLE IF NOT EXISTS wcreation.user_device_access (
  user_id uuid NOT NULL REFERENCES wcreation.users (id) ON DELETE CASCADE,
  device_id uuid NOT NULL REFERENCES wcreation.devices (id) ON DELETE CASCADE,
  permiso wcreation.user_device_permiso NOT NULL DEFAULT 'ver',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, device_id)
);

CREATE INDEX IF NOT EXISTS user_device_access_device_id_idx ON wcreation.user_device_access (device_id);

CREATE TABLE IF NOT EXISTS wcreation.device_thresholds (
  device_id uuid PRIMARY KEY REFERENCES wcreation.devices (id) ON DELETE CASCADE,
  temp_interna_min double precision,
  temp_interna_max double precision,
  temp_ambiente_min double precision,
  temp_ambiente_max double precision,
  bateria_min_pct smallint,
  corte_red_max_seg integer,
  puerta_abierta_max_seg integer,
  modificable_por_responsable boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS wcreation.public_qr_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id uuid REFERENCES wcreation.devices (id) ON DELETE CASCADE,
  group_id uuid REFERENCES wcreation.groups (id) ON DELETE CASCADE,
  token_publico text NOT NULL UNIQUE,
  activo boolean NOT NULL DEFAULT true,
  creado_en timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT public_qr_tokens_target_xor CHECK (
    (device_id IS NOT NULL AND group_id IS NULL)
    OR (device_id IS NULL AND group_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS public_qr_tokens_device_id_idx ON wcreation.public_qr_tokens (device_id);
CREATE INDEX IF NOT EXISTS public_qr_tokens_group_id_idx ON wcreation.public_qr_tokens (group_id);

CREATE TABLE IF NOT EXISTS wcreation.notification_preferences (
  user_id uuid NOT NULL REFERENCES wcreation.users (id) ON DELETE CASCADE,
  canal wcreation.notification_canal NOT NULL,
  evento_tipo text NOT NULL,
  habilitado boolean NOT NULL DEFAULT true,
  telegram_chat_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, canal, evento_tipo)
);
