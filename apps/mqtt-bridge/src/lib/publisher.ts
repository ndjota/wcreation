import type { RedisConn } from "../redis-types.js";

export async function publishDeviceChannel(
  redis: RedisConn,
  deviceId: string,
  message: Record<string, unknown>,
): Promise<void> {
  await redis.publish(`wcreation:device:${deviceId}`, JSON.stringify(message));
}
